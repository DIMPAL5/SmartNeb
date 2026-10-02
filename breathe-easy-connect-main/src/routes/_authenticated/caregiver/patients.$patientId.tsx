import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  BatteryMedium,
  CalendarCheck,
  Cpu,
  HeartPulse,
  Mail,
  NotebookPen,
  Phone,
  Thermometer,
} from "lucide-react";
import { toast } from "sonner";
import {
  addCaregiverNote,
  getCarePatientDetail,
  listCaregiverNotes,
} from "@/lib/caregiver-detail.functions";
import { getAdherence, getTelemetrySeries, listAlerts, listSessions } from "@/lib/smartneb.functions";
import { CaregiverPage } from "@/components/smartneb/caregiver-layout";
import { useSignedIn } from "@/components/smartneb/use-signed-in";
import { SOSPanel } from "@/components/smartneb/sos-panel";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { StatusBadge, VitalCard, freshness, type VitalStatus } from "@/components/smartneb/vitals";
import { TrendChart } from "@/components/smartneb/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/caregiver/patients/$patientId")({
  head: () => ({
    meta: [
      { title: "Patient Detail — SmartNeb Caregiver" },
      {
        name: "description",
        content:
          "Live and historical vitals, device status, alerts, care plan, medication schedule and caregiver notes for a patient in your care.",
      },
      { property: "og:title", content: "Patient Detail — SmartNeb Caregiver" },
      {
        property: "og:description",
        content: "Vitals, alerts, care plan and notes for a patient you support.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CarePatientDetailPage,
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

function CarePatientDetailPage() {
  const { patientId } = Route.useParams();
  const t = useT();
  return (
    <CaregiverPage title={t("caregiver.patientDetailTitle")} subtitle={t("caregiver.patientDetailSubtitle")}>
      {() => <DetailBody patientId={patientId} />}
    </CaregiverPage>
  );
}

function DetailBody({ patientId }: { patientId: string }) {
  const t = useT();
  const signedIn = useSignedIn() === true;

  const detail = useQuery({
    queryKey: ["care-detail", patientId],
    queryFn: () => getCarePatientDetail({ data: { patientId } }),
    enabled: signedIn,
    retry: false,
    refetchInterval: signedIn ? 10_000 : false,
  });

  if (detail.isPending) return <LoadingSkeleton rows={4} />;
  if (detail.isError)
    return <ErrorState message={(detail.error as Error)?.message} onRetry={() => detail.refetch()} />;

  const d = detail.data;
  const p = d.patient;
  const fresh = freshness(d.health?.recorded_at);
  const activePlan = d.carePlans.find((c) => c.status === "published") ?? d.carePlans[0] ?? null;

  return (
    <div className="space-y-6">
      <Link
        to="/caregiver/patients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t("caregiver.backToMyPatients")}
      </Link>

      <section className="panel flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold">{p.full_name}</h2>
          <p className="text-sm text-muted-foreground">
            {p.mrn} · {p.condition ?? t("caregiver.noConditionRecorded")}
            {d.relation ? ` · ${t("caregiver.yourRelation", { relation: d.relation })}` : ""}
            {p.date_of_birth ? ` · ${t("caregiver.dobLabel", { date: p.date_of_birth })}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {d.contact?.phone ? (
              <a href={`tel:${d.contact.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="size-3.5" aria-hidden /> {d.contact.phone}
              </a>
            ) : null}
            {d.contact?.email ? (
              <a href={`mailto:${d.contact.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Mail className="size-3.5" aria-hidden /> {d.contact.email}
              </a>
            ) : null}
            {d.doctors.length ? (
              <span>
                {t("caregiver.careDoctorLabel")}: {d.doctors.map((doc) => `${doc.full_name} (${doc.specialty})`).join(", ")}
              </span>
            ) : null}
          </div>
        </div>
        <StatusBadge
          status={fresh.stale ? "unknown" : "normal"}
          label={fresh.stale ? t("caregiver.staleLabel", { time: fresh.text }) : t("caregiver.liveLabel", { time: fresh.text })}
        />
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <VitalCard
          label={t("caregiver.oxygenSaturation")}
          value={d.health?.spo2 ?? null}
          unit="%"
          status={spo2Status(d.health?.spo2 ?? null, p.spo2_threshold)}
          hint={t("caregiver.thresholdHint", { value: `${p.spo2_threshold}%` })}
          icon={<Activity className="size-4" aria-hidden />}
        />
        <VitalCard
          label={t("caregiver.heartRate")}
          value={d.health?.bpm ?? null}
          unit="bpm"
          status={bpmStatus(d.health?.bpm ?? null, p.bpm_low_threshold, p.bpm_high_threshold)}
          hint={t("caregiver.rangeHint", { value: `${p.bpm_low_threshold}-${p.bpm_high_threshold}` })}
          icon={<HeartPulse className="size-4" aria-hidden />}
        />
        <VitalCard
          label={t("caregiver.bodyTemperature")}
          value={d.health?.body_temperature == null ? null : d.health.body_temperature.toFixed(1)}
          unit="°C"
          status={tempStatus(d.health?.body_temperature ?? null, p.temp_threshold)}
          hint={t("caregiver.maxHint", { value: `${p.temp_threshold}°C` })}
          icon={<Thermometer className="size-4" aria-hidden />}
        />
        <VitalCard
          label={t("caregiver.deviceBattery")}
          value={d.battery?.percentage ?? null}
          unit="%"
          status={
            d.battery?.percentage == null
              ? "unknown"
              : d.battery.percentage < 15
                ? "critical"
                : d.battery.percentage < 30
                  ? "warning"
                  : "normal"
          }
          hint={d.battery?.charging ? t("caregiver.charging") : fresh.text}
          icon={<BatteryMedium className="size-4" aria-hidden />}
        />
      </div>

      <section className="panel flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-2">
          <Cpu className="size-4 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-medium">{d.device?.device_code ?? t("caregiver.noDevice")}</p>
            <p className="text-xs text-muted-foreground">
              {t("caregiver.firmwareLastSeen", {
                firmware: d.device?.firmware ?? "--",
                time: freshness(d.device?.last_seen_at).text,
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={d.device?.status === "online" ? "normal" : "critical"}
            label={d.device?.status === "online" ? t("status.online") : t("status.offline")}
          />
          <StatusBadge
            status={d.device?.mqtt_connected ? "normal" : "warning"}
            label={d.device?.mqtt_connected ? t("caregiver.mqttLinked") : t("caregiver.mqttDown")}
          />
          <StatusBadge
            status={d.activeSession?.status === "running" ? "normal" : d.activeSession ? "warning" : "unknown"}
            label={d.activeSession ? t("caregiver.therapyStatus", { status: d.activeSession.status }) : t("caregiver.noActiveTherapy")}
          />
          <span className="text-xs text-muted-foreground">
            {t("caregiver.chamberPercent", { value: Math.round(d.device?.fluid_level ?? 0) })}
          </span>
        </div>
      </section>

      <Tabs defaultValue="history">
        <TabsList className="flex-wrap">
          <TabsTrigger value="history">{t("caregiver.vitalsHistory")}</TabsTrigger>
          <TabsTrigger value="alerts">{t("nav.alerts")}</TabsTrigger>
          <TabsTrigger value="plan">{t("caregiver.carePlanTab")}</TabsTrigger>
          <TabsTrigger value="adherence">{t("nav.adherence")}</TabsTrigger>
          <TabsTrigger value="notes">{t("caregiver.caregiverNotesTab")}</TabsTrigger>
          <TabsTrigger value="sos">{t("caregiver.sosHistory")}</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-4">
          <HistoryTab patientId={patientId} signedIn={signedIn} />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <AlertsTab patientId={patientId} signedIn={signedIn} />
        </TabsContent>
        <TabsContent value="plan" className="mt-4">
          <PlanTab plans={d.carePlans} active={activePlan} />
        </TabsContent>
        <TabsContent value="adherence" className="mt-4">
          <AdherenceTab patientId={patientId} signedIn={signedIn} />
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <NotesTab patientId={patientId} signedIn={signedIn} />
        </TabsContent>
        <TabsContent value="sos" className="mt-4">
          <SOSPanel patientId={patientId} enabled={signedIn} includeResolved title={t("caregiver.emergencyHistory")} />
        </TabsContent>
      </Tabs>
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

  if (q.isLoading) return <LoadingSkeleton rows={2} />;
  const health = (q.data?.health ?? []).map((r) => ({
    t: r.recorded_at,
    spo2: r.spo2 == null ? null : Number(r.spo2),
    bpm: r.bpm == null ? null : Number(r.bpm),
    temp: r.body_temperature == null ? null : Number(r.body_temperature),
  }));
  if (!health.length)
    return <EmptyState title={t("caregiver.noTelemetryYet")} description={t("caregiver.telemetryDescription")} />;

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <h3 className="font-display text-sm font-semibold">{t("caregiver.oxygenSaturationLast24h")}</h3>
        <TrendChart
          data={health}
          series={[{ key: "spo2", label: t("vitals.spo2Percent"), color: "var(--chart-1)" }]}
          domain={[80, 100]}
          area
        />
      </div>
      <div className="panel p-5">
        <h3 className="font-display text-sm font-semibold">{t("caregiver.heartRateTempLast24h")}</h3>
        <TrendChart
          data={health}
          series={[
            { key: "bpm", label: t("caregiver.heartRate"), color: "var(--chart-2)" },
            { key: "temp", label: t("caregiver.temperatureC"), color: "var(--chart-3)" },
          ]}
        />
      </div>
    </div>
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
    return <EmptyState title={t("caregiver.noAlerts")} description={t("caregiver.readingsWithinRange")} />;

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
            status={a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "normal"}
            label={a.severity}
          />
        </li>
      ))}
    </ul>
  );
}

function PlanTab({
  plans,
  active,
}: {
  plans: { id: string; medication: string; dosage: string; duration_minutes: number; frequency_per_day: number; instructions: string | null; start_date: string; end_date: string | null; status: string; doctorName: string | null }[];
  active: { id: string } | null;
}) {
  const t = useT();
  if (!plans.length)
    return <EmptyState title={t("caregiver.noCarePlan")} description={t("caregiver.noCarePlanDescription")} />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t("caregiver.carePlanReadOnlyNote")}
      </p>
      {plans.map((plan) => (
        <article key={plan.id} className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold">
              {plan.medication} · {plan.dosage}
            </h3>
            <div className="flex items-center gap-2">
              {active && plan.id === active.id ? <Badge variant="secondary">{t("caregiver.current")}</Badge> : null}
              <Badge variant={plan.status === "published" ? "default" : "outline"}>{plan.status}</Badge>
            </div>
          </div>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
            {[
              [t("caregiver.sessionLength"), `${plan.duration_minutes} min`],
              [t("caregiver.frequency"), t("caregiver.timesDaily", { count: plan.frequency_per_day })],
              [t("caregiver.start"), plan.start_date],
              [t("caregiver.end"), plan.end_date ?? t("caregiver.ongoing")],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border bg-surface-2 p-3">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {plan.instructions ? (
            <p className="mt-3 text-sm text-muted-foreground">{plan.instructions}</p>
          ) : null}
          {plan.doctorName ? (
            <p className="mt-2 text-xs text-muted-foreground">{t("caregiver.prescribedBy", { name: plan.doctorName })}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function AdherenceTab({ patientId, signedIn }: { patientId: string; signedIn: boolean }) {
  const t = useT();
  const adherence = useQuery({
    queryKey: ["adherence", patientId, 30],
    queryFn: () => getAdherence({ data: { patientId, days: 30 } }),
    enabled: signedIn,
    retry: false,
  });
  const sessions = useQuery({
    queryKey: ["sessions", patientId],
    queryFn: () => listSessions({ data: { patientId, limit: 15 } }),
    enabled: signedIn,
    retry: false,
  });

  if (adherence.isLoading) return <LoadingSkeleton rows={3} />;
  const d = adherence.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: t("caregiver.adherenceScore"), value: `${d?.score ?? 0}%` },
          { label: t("caregiver.completed"), value: d?.completed ?? 0 },
          { label: t("caregiver.partial"), value: d?.partial ?? 0 },
          { label: t("caregiver.missed"), value: d?.missed ?? 0 },
        ].map((m) => (
          <div key={m.label} className="panel p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarCheck className="size-3.5" aria-hidden /> {m.label}
            </div>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="panel p-5">
        <h3 className="font-display text-sm font-semibold">{t("caregiver.medicationSessions")}</h3>
        {sessions.isLoading ? (
          <LoadingSkeleton rows={2} className="mt-3" />
        ) : !sessions.data?.length ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("caregiver.noSessionsRecorded")}</p>
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
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {Math.round(s.elapsed_seconds / 60)} / {Math.round(s.prescribed_seconds / 60)} min
                  <Badge
                    variant={
                      s.status === "completed"
                        ? "secondary"
                        : s.status === "failed" || s.status === "stopped"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {s.status}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NotesTab({ patientId, signedIn }: { patientId: string; signedIn: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const notes = useQuery({
    queryKey: ["caregiver-notes", patientId],
    queryFn: () => listCaregiverNotes({ data: { patientId } }),
    enabled: signedIn,
    retry: false,
  });

  const add = useMutation({
    mutationFn: () => addCaregiverNote({ data: { patientId, note } }),
    onSuccess: () => {
      setNote("");
      toast.success(t("caregiver.observationSaved"));
      void qc.invalidateQueries({ queryKey: ["caregiver-notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <form
        className="panel space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (note.trim().length < 2) return;
          add.mutate();
        }}
      >
        <label htmlFor="note" className="flex items-center gap-2 font-display text-sm font-semibold">
          <NotebookPen className="size-4" aria-hidden /> {t("caregiver.addObservation")}
        </label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={t("caregiver.observationPlaceholder")}
        />
        <Button type="submit" disabled={add.isPending || note.trim().length < 2}>
          {add.isPending ? t("caregiver.saving") : t("caregiver.saveObservation")}
        </Button>
      </form>

      {notes.isLoading ? (
        <LoadingSkeleton rows={2} />
      ) : !notes.data?.length ? (
        <EmptyState title={t("caregiver.noObservationsYet")} description={t("caregiver.notesAppearHere")} />
      ) : (
        <ul className="space-y-2">
          {notes.data.map((n) => (
            <li key={n.id} className="rounded-lg border bg-surface-2 px-4 py-3">
              <p className="text-sm">{n.note}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.authorName} · {new Date(n.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
