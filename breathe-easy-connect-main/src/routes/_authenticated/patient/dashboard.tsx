import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BatteryMedium,
  Cpu,
  Droplets,
  Gauge,
  HeartPulse,
  Radio,
  Siren,
  Thermometer,
  Wind,
} from "lucide-react";
import { toast } from "sonner";
import { ingestDeviceTelemetry, raiseAlert, triggerSOS } from "@/lib/smartneb.functions";
import { useDeviceTelemetry } from "@/hooks/use-device-telemetry";
import { PatientPage, greetingKey, useSnapshot } from "@/components/smartneb/patient-layout";
import { freshness, StatusBadge, VitalCard, type VitalStatus } from "@/components/smartneb/vitals";
import { NebulizerControl } from "@/components/smartneb/nebulizer-control";
import { ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SOSPanel } from "@/components/smartneb/sos-panel";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/patient/dashboard")({
  head: () => ({
    meta: [
      { title: "Patient Dashboard — SmartNeb" },
      {
        name: "description",
        content:
          "Live vitals, nebulizer status, device telemetry and therapy adherence for your connected SmartNeb device.",
      },
      { property: "og:title", content: "Patient Dashboard — SmartNeb" },
      {
        property: "og:description",
        content: "Your live respiratory therapy command center.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function spo2Status(v: number | null, threshold: number): VitalStatus {
  if (v == null) return "unknown";
  if (v < threshold - 3) return "critical";
  if (v < threshold) return "warning";
  return "normal";
}

function RouteComponent() {
  const t = useT();
  return (
    <PatientPage title={t("patient.dashboard.title")} subtitle={t("patient.dashboard.subtitle")}>
      {({ patientId, fullName }) => <DashboardBody patientId={patientId} fullName={fullName} />}
    </PatientPage>
  );
}

function DashboardBody({ patientId, fullName }: { patientId: string; fullName: string }) {
  const t = useT();
  const qc = useQueryClient();
  const snap = useSnapshot(patientId);
  const spokenRef = useRef(0);

  // Real ESP32 telemetry (Firebase Realtime Database).
  const dev = useDeviceTelemetry({
    patientId,
    mrn: snap.data?.patient?.mrn ?? null,
    deviceCode: snap.data?.device?.device_code ?? null,
  });
  const tel = dev.telemetry;

  // Archive real readings so history, reports and the alert engine stay truthful.
  const ingest = useMutation({
    mutationFn: () =>
      ingestDeviceTelemetry({
        data: {
          patientId,
          bpm: tel.bpm,
          spo2: tel.spo2,
          bodyTemperature: tel.bodyTemperature,
          ambientTemperature: tel.ambientTemperature,
          batteryPercentage: tel.battery.percentage,
          batteryVoltage: tel.battery.voltage,
          batteryCurrent: tel.battery.current,
          batteryPower: tel.battery.power,
          batteryTemperature: tel.battery.temperature,
          relay: tel.nebulizer.relay,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snapshot", patientId] }),
  });
  const ingestRef = useRef(ingest);
  ingestRef.current = ingest;
  const onlineForIngest = tel.online;

  useEffect(() => {
    if (!onlineForIngest) return;
    const id = setInterval(() => ingestRef.current.mutate(), 30_000);
    return () => clearInterval(id);
  }, [onlineForIngest]);

  const alert = useMutation({
    mutationFn: (vars: {
      type: string;
      severity: "critical" | "warning" | "info";
      value: number;
      threshold: number;
      message: string;
    }) => raiseAlert({ data: { patientId, ...vars } }),
    onSuccess: (res) => {
      if (res.created) void qc.invalidateQueries({ queryKey: ["snapshot", patientId] });
    },
  });

  const sos = useMutation({
    mutationFn: () => triggerSOS({ data: { patientId, source: "manual" } }),
    onSuccess: (res) => {
      toast.error(t("patient.dashboard.sosSentTitle"), {
        description: t("patient.dashboard.sosSentDesc", { count: res.notified }),
      });
      void qc.invalidateQueries({ queryKey: ["sos-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { patient, device, health, healthPrev, environment, battery, carePlan, activeSession } =
    snap.data ?? ({} as NonNullable<typeof snap.data>);
  // Live device values take precedence; stored records are the fallback history.
  const spo2 = tel.spo2 ?? (health?.spo2 == null ? null : Number(health.spo2));
  const bpm = tel.bpm ?? (health?.bpm == null ? null : Number(health.bpm));
  const temp =
    tel.bodyTemperature ??
    (health?.body_temperature == null ? null : Number(health.body_temperature));
  const ambient =
    tel.ambientTemperature ??
    (environment?.ambient_temperature == null ? null : Number(environment.ambient_temperature));
  const spo2Threshold = Number(patient?.spo2_threshold ?? 92);
  const battPct =
    tel.battery.percentage ?? (battery?.percentage == null ? null : Number(battery.percentage));
  const fresh = freshness(health?.recorded_at);
  const liveText = dev.loading
    ? t("patient.dashboard.connecting")
    : dev.error
      ? t("patient.dashboard.unableConnect")
      : tel.online
        ? `${t("patient.dashboard.onlineLive")}${tel.lastUpdated ? t("patient.dashboard.updatedSuffix", { time: freshness(new Date(tel.lastUpdated).toISOString()).text }) : ""}`
        : t("patient.dashboard.offlineLastReading", { fresh: fresh.text });

  // Threshold engine: SpO2 below configured threshold raises an alert + audio/voice warning.
  useEffect(() => {
    if (spo2 == null || spo2 >= spo2Threshold) return;
    const now = Date.now();
    if (now - spokenRef.current < 60_000) return;
    spokenRef.current = now;
    alert.mutate({
      type: "spo2",
      severity: spo2 < spo2Threshold - 3 ? "critical" : "warning",
      value: spo2,
      threshold: spo2Threshold,
      message: `SpO2 ${spo2}% is below the configured threshold of ${spo2Threshold}%`,
    });
    try {
      const u = new SpeechSynthesisUtterance(
        `Warning. Oxygen saturation ${spo2} percent, below your threshold.`,
      );
      window.speechSynthesis.speak(u);
    } catch {
      /* speech unavailable */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spo2, spo2Threshold]);

  if (snap.isLoading) return <LoadingSkeleton rows={4} />;
  if (snap.isError || !snap.data)
    return <ErrorState message={(snap.error as Error)?.message} onRetry={() => snap.refetch()} />;

  return (
    <div className="space-y-6">
      <section className="panel grid-mesh flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="font-display text-2xl font-semibold">
            {t(greetingKey())}, {patient?.full_name ?? fullName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{liveText}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={tel.online ? "normal" : "critical"}
              label={
                tel.online
                  ? t("patient.dashboard.esp32Connected")
                  : t("patient.dashboard.esp32Offline")
              }
            />
            <StatusBadge
              status={dev.firebaseConnected ? "normal" : "warning"}
              label={
                dev.firebaseConnected
                  ? t("patient.dashboard.cloudLinked")
                  : t("patient.dashboard.cloudDown")
              }
            />
            <StatusBadge
              status={tel.nebulizer.relay ? "normal" : "unknown"}
              label={
                tel.nebulizer.relay ? t("patient.dashboard.nebOn") : t("patient.dashboard.nebOff")
              }
            />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={sos.isPending}>
                <Siren className="mr-2 size-4" /> {t("nav.sos")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("patient.dashboard.sosConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("patient.dashboard.sosConfirmDesc", {
                    spo2: spo2 ?? "--",
                    bpm: bpm ?? "--",
                    temp: temp ?? "--",
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("action.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-critical text-critical-foreground hover:bg-critical/90"
                  onClick={() => sos.mutate()}
                >
                  {t("patient.dashboard.sosConfirmAction")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <VitalCard
          label={t("vitals.heartRate")}
          value={bpm}
          unit="bpm"
          icon={<HeartPulse className="size-4" />}
          status={bpm == null ? "unknown" : bpm > 120 || bpm < 50 ? "warning" : "normal"}
          trend={bpm != null && healthPrev?.bpm != null ? bpm - Number(healthPrev.bpm) : null}
          hint={fresh.text}
        />
        <VitalCard
          label={t("vitals.spo2")}
          value={spo2}
          unit="%"
          icon={<Activity className="size-4" />}
          status={spo2Status(spo2, spo2Threshold)}
          trend={spo2 != null && healthPrev?.spo2 != null ? spo2 - Number(healthPrev.spo2) : null}
          hint={t("patient.dashboard.thresholdHint", { threshold: spo2Threshold })}
        />
        <VitalCard
          label={t("vitals.bodyTemp")}
          value={temp}
          unit="°C"
          icon={<Thermometer className="size-4" />}
          status={temp == null ? "unknown" : temp >= 38 ? "warning" : "normal"}
          trend={
            temp != null && healthPrev?.body_temperature != null
              ? temp - Number(healthPrev.body_temperature)
              : null
          }
          hint={fresh.text}
        />
        <VitalCard
          label={t("patient.dashboard.deviceBattery")}
          value={battPct}
          unit="%"
          icon={<BatteryMedium className="size-4" />}
          status={
            battPct == null
              ? "unknown"
              : battPct < 15
                ? "critical"
                : battPct < 30
                  ? "warning"
                  : "normal"
          }
          hint={`${tel.battery.voltage ?? battery?.voltage ?? "--"} V · ${tel.battery.temperature ?? battery?.cell_temperature ?? "--"} °C`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel space-y-4 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-semibold">
              {t("patient.dashboard.environment")}
            </p>
            <StatusBadge
              status={
                environment?.aqi == null
                  ? "unknown"
                  : Number(environment.aqi) > 100
                    ? "warning"
                    : "normal"
              }
              label={
                environment?.aqi == null
                  ? t("patient.dashboard.noData")
                  : Number(environment.aqi) > 100
                    ? t("patient.dashboard.poorAir")
                    : t("patient.dashboard.goodAir")
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: t("vitals.ambientTemp"), value: ambient, unit: "°C", icon: Thermometer },
              {
                label: t("patient.dashboard.humidity"),
                value: environment?.humidity ?? null,
                unit: "%",
                icon: Droplets,
              },
              {
                label: t("patient.dashboard.airQualityIndex"),
                value: environment?.aqi ?? null,
                unit: "AQI",
                icon: Wind,
              },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border bg-surface-2 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <m.icon className="size-3.5" /> {m.label}
                </div>
                <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
                  {m.value == null ? "--" : Number(m.value)}
                  <span className="ml-1 text-xs text-muted-foreground">{m.unit}</span>
                </p>
              </div>
            ))}
          </div>
          {environment?.humidity == null || environment?.aqi == null ? (
            <p className="text-xs text-muted-foreground">
              {t("patient.dashboard.sensorsNotReporting")}
            </p>
          ) : null}

          <div className="rounded-xl border bg-surface-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">
                    {device?.device_code ?? t("patient.dashboard.noDevice")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("patient.dashboard.firmwareLastSeen", {
                      firmware: device?.firmware ?? "--",
                      seen: freshness(device?.last_seen_at).text,
                    })}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={tel.online ? "normal" : "critical"}
                  label={tel.online ? t("status.online") : t("status.offline")}
                />
                <StatusBadge
                  status={dev.firebaseConnected ? "normal" : "warning"}
                  label={
                    dev.firebaseConnected
                      ? t("patient.dashboard.realtimeLinked")
                      : t("patient.dashboard.realtimeDown")
                  }
                />
                <StatusBadge
                  status={tel.nebulizer.relay ? "normal" : "unknown"}
                  label={`${t("patient.dashboard.relayLabel")} ${tel.nebulizer.relay ? "ON" : "OFF"}`}
                />
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Radio className="size-3.5" />{" "}
                  {t("patient.dashboard.chamberPct", { value: Number(device?.fluid_level ?? 0) })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <NebulizerControl
          patientId={patientId}
          session={activeSession}
          deviceOnline={tel.online}
          onRelay={dev.setRelay}
          medication={carePlan?.medication ?? null}
          dosage={carePlan?.dosage ?? null}
          prescribedMinutes={carePlan?.duration_minutes ?? 10}
          compact
        />
      </section>

      <section className="panel p-5">
        <div className="mb-3 flex items-center gap-2">
          <Gauge className="size-4 text-primary" />
          <p className="font-display text-sm font-semibold">
            {t("patient.dashboard.activeAlerts")}
          </p>
        </div>
        {snap.data.activeAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("patient.dashboard.noActiveAlerts")}</p>
        ) : (
          <ul className="space-y-2">
            {snap.data.activeAlerts.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-surface-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{a.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.type} · {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                <StatusBadge
                  status={
                    a.severity === "critical"
                      ? "critical"
                      : a.severity === "warning"
                        ? "warning"
                        : "normal"
                  }
                  label={a.severity}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <SOSPanel
        patientId={patientId}
        canRespond={false}
        includeResolved
        title={t("patient.dashboard.sosHistoryTitle")}
      />
    </div>
  );
}
