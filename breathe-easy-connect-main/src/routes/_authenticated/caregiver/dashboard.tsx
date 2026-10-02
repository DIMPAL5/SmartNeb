import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BatteryMedium,
  CalendarCheck,
  Cpu,
  HeartPulse,
  Search,
  Siren,
  Thermometer,
  Wind,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdherence,
  getPatientSnapshot,
  getTelemetrySeries,
  listAlerts,
  listSessions,
} from "@/lib/smartneb.functions";
import { listMyCarePatients, type CaregiverPatientRow } from "@/lib/caregiver.functions";
import { AppShell, caregiverNav } from "@/components/smartneb/app-shell";
import { useMe } from "@/components/smartneb/patient-layout";
import { SOSPanel } from "@/components/smartneb/sos-panel";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { StatusBadge, VitalCard, freshness, type VitalStatus } from "@/components/smartneb/vitals";
import { TrendChart } from "@/components/smartneb/charts";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useT, type TFunction } from "@/i18n";

export const Route = createFileRoute("/_authenticated/caregiver/dashboard")({
  head: () => ({
    meta: [
      { title: "Caregiver Dashboard — SmartNeb" },
      {
        name: "description",
        content:
          "Follow the people you care for in real time: live vitals, device status, therapy adherence, alerts and emergency SOS response.",
      },
      { property: "og:title", content: "Caregiver Dashboard — SmartNeb" },
      {
        property: "og:description",
        content: "Live vitals, adherence and emergency response for the patients you support.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CaregiverDashboard,
});

function spo2Status(v: number | null, min: number): VitalStatus {
  if (v == null) return "unknown";
  if (v < min - 3) return "critical";
  if (v < min) return "warning";
  return "normal";
}
function bpmStatus(v: number | null, low: number, high: number): VitalStatus {
  if (v == null) return "unknown";
  if (v < low - 10 || v > high + 15) return "critical";
  if (v < low || v > high) return "warning";
  return "normal";
}
function tempStatus(v: number | null, max: number): VitalStatus {
  if (v == null) return "unknown";
  if (v > max + 1) return "critical";
  if (v > max) return "warning";
  return "normal";
}

function CaregiverDashboard() {
  const t = useT();
  const me = useMe();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(Boolean(session));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const roster = useQuery({
    queryKey: ["caregiver-patients"],
    queryFn: () => listMyCarePatients(),
    enabled: signedIn,
    retry: false,
    refetchInterval: signedIn ? 15_000 : false,
  });

  useEffect(() => {
    if (!selected && roster.data?.length) setSelected(roster.data[0]!.id);
  }, [roster.data, selected]);

  useEffect(() => {
    if (!signedIn) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["caregiver-patients"] });
      void queryClient.invalidateQueries({ queryKey: ["snapshot"] });
    };
    const channel = supabase
      .channel("caregiver-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "health_telemetry" },
        invalidate,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, invalidate)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nebulization_sessions" },
        invalidate,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, signedIn]);

  const patients = useMemo(() => {
    const list = roster.data ?? [];
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? list.filter(
          (p) =>
            p.full_name.toLowerCase().includes(needle) ||
            p.mrn.toLowerCase().includes(needle) ||
            (p.condition ?? "").toLowerCase().includes(needle),
        )
      : list;
    return [...filtered].sort(
      (a, b) =>
        b.activeSOS - a.activeSOS ||
        b.criticalAlerts - a.criticalAlerts ||
        b.activeAlerts - a.activeAlerts,
    );
  }, [roster.data, q]);

  if (me.isPending) {
    return (
      <div className="p-8">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }
  if (me.isError || !me.data) {
    return (
      <div className="p-8">
        <ErrorState message={(me.error as Error)?.message} onRetry={() => me.refetch()} />
      </div>
    );
  }

  const sosCount = (roster.data ?? []).reduce((n, p) => n + p.activeSOS, 0);
  const critical = (roster.data ?? []).reduce((n, p) => n + p.criticalAlerts, 0);

  return (
    <AppShell
      me={me.data}
      nav={caregiverNav}
      title={t("caregiver.careDashboard")}
      subtitle={t("caregiver.careDashboardSubtitle", {
        count: roster.data?.length ?? 0,
        sos: sosCount,
        critical,
      })}
    >
      {!me.data.caregiverId ? (
        <ErrorState message={t("caregiver.noCaregiverRecordShort")} />
      ) : (
        <div className="space-y-6">
          <SOSPanel enabled={signedIn} title={t("caregiver.emergencySosPeopleInCare")} />

          <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
            <section className="panel flex max-h-[calc(100vh-11rem)] flex-col p-4">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-muted-foreground" aria-hidden />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("caregiver.searchPatientsPlaceholder")}
                  aria-label={t("caregiver.searchPatients")}
                  className="h-9"
                />
              </div>
              <ScrollArea className="mt-3 flex-1">
                {roster.isLoading ? (
                  <LoadingSkeleton rows={3} />
                ) : patients.length === 0 ? (
                  <EmptyState
                    title={t("caregiver.noAssignedPatients")}
                    description={t("caregiver.assignedPatientsAppearHere")}
                  />
                ) : (
                  <ul className="space-y-2 pr-2">
                    {patients.map((p) => (
                      <li key={p.id}>
                        <RosterCard
                          patient={p}
                          active={p.id === selected}
                          onSelect={() => setSelected(p.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </section>

            {selected ? (
              <PatientWorkspace
                key={selected}
                signedIn={signedIn}
                patient={patients.find((p) => p.id === selected) ?? null}
                patientId={selected}
              />
            ) : (
              <EmptyState
                title={t("caregiver.selectAPatientTitle")}
                description={t("caregiver.selectAPatientDescription")}
              />
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function RosterCard({
  patient,
  active,
  onSelect,
}: {
  patient: CaregiverPatientRow;
  active: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  const fresh = freshness(patient.recordedAt);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{patient.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {patient.mrn} · {patient.condition ?? t("caregiver.noConditionRecorded")}
          </p>
        </div>
        <StatusBadge status={spo2Status(patient.spo2, patient.spo2_threshold)} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {t("vitals.spo2")} {patient.spo2 ?? "--"}%
        </span>
        <span className="tabular-nums">
          {t("caregiver.hrAbbrev")} {patient.bpm ?? "--"}
        </span>
        <span>{fresh.text}</span>
        {patient.activeSOS > 0 ? (
          <Badge variant="destructive" className="gap-1">
            <Siren className="size-3" /> {t("caregiver.sos")}
          </Badge>
        ) : null}
        {patient.sessionStatus === "running" ? (
          <Badge variant="secondary" className="gap-1">
            <Wind className="size-3" /> {t("caregiver.inTherapy")}
          </Badge>
        ) : null}
        {patient.activeAlerts > 0 ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="size-3" /> {patient.activeAlerts}
          </Badge>
        ) : null}
      </div>
    </button>
  );
}

function PatientWorkspace({
  patient,
  patientId,
  signedIn,
}: {
  patient: CaregiverPatientRow | null;
  patientId: string;
  signedIn: boolean;
}) {
  const t = useT();
  const snapshot = useQuery({
    queryKey: ["snapshot", patientId],
    queryFn: () => getPatientSnapshot({ data: { patientId } }),
    enabled: signedIn,
    retry: false,
    refetchInterval: signedIn ? 5_000 : false,
  });

  const snap = snapshot.data;
  const p = snap?.patient;
  const device = snap?.device;
  const spo2 = snap?.health?.spo2 == null ? null : Number(snap.health.spo2);
  const bpm = snap?.health?.bpm == null ? null : Number(snap.health.bpm);
  const temp = snap?.health?.body_temperature == null ? null : Number(snap.health.body_temperature);
  const prevSpo2 = snap?.healthPrev?.spo2 == null ? null : Number(snap.healthPrev.spo2);
  const prevBpm = snap?.healthPrev?.bpm == null ? null : Number(snap.healthPrev.bpm);
  const battPct = snap?.battery?.percentage == null ? null : Number(snap.battery.percentage);
  const fresh = freshness(snap?.health?.recorded_at, Date.now());

  const spo2Min = Number(p?.spo2_threshold ?? patient?.spo2_threshold ?? 92);
  const bpmLow = Number(p?.bpm_low_threshold ?? patient?.bpm_low_threshold ?? 55);
  const bpmHigh = Number(p?.bpm_high_threshold ?? patient?.bpm_high_threshold ?? 120);
  const tempMax = Number(p?.temp_threshold ?? patient?.temp_threshold ?? 38);

  return (
    <section className="space-y-6">
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold">
            {p?.full_name ?? patient?.full_name ?? t("caregiver.patient")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {p?.mrn ?? patient?.mrn} · {p?.condition ?? t("caregiver.noConditionRecorded")}
            {patient?.relation
              ? ` · ${t("caregiver.yourRelation", { relation: patient.relation })}`
              : ""}
          </p>
        </div>
        <StatusBadge
          status={fresh.stale ? "unknown" : "normal"}
          label={
            fresh.stale
              ? t("caregiver.staleLabel", { time: fresh.text })
              : t("caregiver.liveLabel", { time: fresh.text })
          }
        />
      </div>

      {snapshot.isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <VitalCard
            label={t("caregiver.oxygenSaturation")}
            value={spo2}
            unit="%"
            status={spo2Status(spo2, spo2Min)}
            trend={spo2 != null && prevSpo2 != null ? spo2 - prevSpo2 : null}
            hint={t("caregiver.thresholdHint", { value: `${spo2Min}%` })}
            icon={<Activity className="size-4" aria-hidden />}
          />
          <VitalCard
            label={t("caregiver.heartRate")}
            value={bpm}
            unit="bpm"
            status={bpmStatus(bpm, bpmLow, bpmHigh)}
            trend={bpm != null && prevBpm != null ? bpm - prevBpm : null}
            hint={t("caregiver.rangeHint", { value: `${bpmLow}-${bpmHigh}` })}
            icon={<HeartPulse className="size-4" aria-hidden />}
          />
          <VitalCard
            label={t("caregiver.bodyTemperature")}
            value={temp == null ? null : temp.toFixed(1)}
            unit="°C"
            status={tempStatus(temp, tempMax)}
            hint={t("caregiver.maxHint", { value: `${tempMax}°C` })}
            icon={<Thermometer className="size-4" aria-hidden />}
          />
          <VitalCard
            label={t("caregiver.deviceBattery")}
            value={battPct}
            unit="%"
            status={
              battPct == null
                ? "unknown"
                : battPct < 15
                  ? "critical"
                  : battPct < 30
                    ? "warning"
                    : "normal"
            }
            hint={fresh.text}
            icon={<BatteryMedium className="size-4" aria-hidden />}
          />
        </div>
      )}

      <div className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-medium">
                {device?.device_code ?? t("caregiver.noDevice")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("caregiver.firmwareLastSeen", {
                  firmware: device?.firmware ?? "--",
                  time: freshness(device?.last_seen_at).text,
                })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={device?.status === "online" ? "normal" : "critical"}
              label={device?.status === "online" ? t("status.online") : t("status.offline")}
            />
            <StatusBadge
              status={device?.mqtt_connected ? "normal" : "warning"}
              label={device?.mqtt_connected ? t("caregiver.mqttLinked") : t("caregiver.mqttDown")}
            />
            <StatusBadge
              status={
                snap?.activeSession?.status === "running"
                  ? "normal"
                  : snap?.activeSession
                    ? "warning"
                    : "unknown"
              }
              label={
                snap?.activeSession
                  ? t("caregiver.therapyStatus", { status: snap.activeSession.status })
                  : t("caregiver.noActiveTherapy")
              }
            />
            <span className="text-xs text-muted-foreground">
              {t("caregiver.chamberPercent", { value: Number(device?.fluid_level ?? 0) })}
            </span>
          </div>
        </div>
        {snap?.carePlan ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("caregiver.currentPlan")}: {snap.carePlan.medication} {snap.carePlan.dosage} ·{" "}
            {snap.carePlan.duration_minutes} min, {snap.carePlan.frequency_per_day}x daily
          </p>
        ) : null}
      </div>

      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts">{t("nav.alerts")}</TabsTrigger>
          <TabsTrigger value="adherence">{t("nav.adherence")}</TabsTrigger>
          <TabsTrigger value="history">{t("caregiver.healthHistory")}</TabsTrigger>
          <TabsTrigger value="sos">{t("caregiver.sosHistory")}</TabsTrigger>
        </TabsList>
        <TabsContent value="alerts" className="mt-4">
          <AlertsTab patientId={patientId} signedIn={signedIn} />
        </TabsContent>
        <TabsContent value="adherence" className="mt-4">
          <AdherenceTab patientId={patientId} signedIn={signedIn} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab patientId={patientId} signedIn={signedIn} />
        </TabsContent>
        <TabsContent value="sos" className="mt-4">
          <SOSPanel
            patientId={patientId}
            enabled={signedIn}
            includeResolved
            title={t("caregiver.emergencyHistory")}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function AlertsTab({ patientId, signedIn }: { patientId: string; signedIn: boolean }) {
  const t = useT();
  const q = useQuery({
    queryKey: ["alerts", patientId],
    queryFn: () => listAlerts({ data: { patientId } }),
    enabled: signedIn,
    retry: false,
    refetchInterval: signedIn ? 15_000 : false,
  });

  if (q.isLoading) return <LoadingSkeleton rows={3} />;
  if (!q.data?.length)
    return (
      <EmptyState
        title={t("caregiver.noAlerts")}
        description={t("caregiver.readingsWithinRange")}
      />
    );

  return (
    <ul className="space-y-2">
      {q.data.map((a) => (
        <li
          key={a.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-surface-2 px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium">{a.message}</p>
            <p className="text-xs text-muted-foreground">
              {a.type} · {new Date(a.created_at).toLocaleString()} · {a.status}
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
  );
}

function AdherenceTab({ patientId, signedIn }: { patientId: string; signedIn: boolean }) {
  const t = useT();
  const q = useQuery({
    queryKey: ["adherence", patientId, 30],
    queryFn: () => getAdherence({ data: { patientId, days: 30 } }),
    enabled: signedIn,
    retry: false,
  });
  const sessions = useQuery({
    queryKey: ["sessions", patientId],
    queryFn: () => listSessions({ data: { patientId, limit: 10 } }),
    enabled: signedIn,
    retry: false,
  });

  if (q.isLoading) return <LoadingSkeleton rows={3} />;
  const d = q.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: t("caregiver.adherenceScore"), value: `${d?.score ?? 0}%`, icon: CalendarCheck },
          { label: t("caregiver.completed"), value: d?.completed ?? 0, icon: CalendarCheck },
          { label: t("caregiver.partial"), value: d?.partial ?? 0, icon: CalendarCheck },
          { label: t("caregiver.missed"), value: d?.missed ?? 0, icon: AlertTriangle },
        ].map((m) => (
          <div key={m.label} className="panel p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <m.icon className="size-3.5" aria-hidden /> {m.label}
            </div>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="panel p-5">
        <h3 className="font-display text-sm font-semibold">
          {t("caregiver.recentTherapySessions")}
        </h3>
        {sessions.isLoading ? (
          <LoadingSkeleton rows={2} className="mt-3" />
        ) : !sessions.data?.length ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("caregiver.noSessionsRecordedYet")}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {sessions.data.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-surface-2 px-4 py-3 text-sm"
              >
                <span>
                  {s.medication ?? t("caregiver.therapy")} {s.dosage ? `· ${s.dosage}` : ""} ·{" "}
                  {new Date(s.started_at).toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(s.elapsed_seconds / 60)} / {Math.round(s.prescribed_seconds / 60)} min
                  · {s.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ patientId, signedIn }: { patientId: string; signedIn: boolean }) {
  const t = useT();
  const q = useQuery({
    queryKey: ["series", patientId, 1440],
    queryFn: () => getTelemetrySeries({ data: { patientId, minutes: 1440 } }),
    enabled: signedIn,
    retry: false,
    refetchInterval: signedIn ? 30_000 : false,
  });

  if (q.isLoading) return <LoadingSkeleton rows={3} />;
  const health = (q.data?.health ?? []).map((r) => ({
    t: r.recorded_at,
    spo2: r.spo2 == null ? null : Number(r.spo2),
    bpm: r.bpm == null ? null : Number(r.bpm),
    temp: r.body_temperature == null ? null : Number(r.body_temperature),
  }));

  if (!health.length)
    return (
      <EmptyState
        title={t("caregiver.noTelemetryYet")}
        description={t("caregiver.readingsLast24h")}
      />
    );

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <h3 className="font-display text-sm font-semibold">
          {t("caregiver.oxygenSaturationLast24h")}
        </h3>
        <TrendChart
          data={health}
          series={[{ key: "spo2", label: "SpO₂ %", color: "var(--chart-1)" }]}
          domain={[80, 100]}
          area
        />
      </div>
      <div className="panel p-5">
        <h3 className="font-display text-sm font-semibold">
          {t("caregiver.heartRateTempLast24h")}
        </h3>
        <TrendChart
          data={health}
          series={[
            { key: "bpm", label: t("caregiver.heartRate"), color: "var(--chart-2)" },
            { key: "temp", label: t("caregiver.temperatureLabel"), color: "var(--chart-3)" },
          ]}
        />
      </div>
    </div>
  );
}
