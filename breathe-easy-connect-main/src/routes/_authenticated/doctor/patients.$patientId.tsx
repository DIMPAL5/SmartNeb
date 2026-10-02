import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  BatteryCharging,
  ClipboardPlus,
  HeartPulse,
  Thermometer,
} from "lucide-react";
import { toast } from "sonner";
import {
  acknowledgeAlert,
  buildReport,
  getAdherence,
  getPatientSnapshot,
  getTelemetrySeries,
  listSessions,
} from "@/lib/smartneb.functions";
import {
  addClinicalNote,
  createCarePlan,
  listCarePlans,
  listClinicalNotes,
  setCarePlanStatus,
} from "@/lib/doctor.functions";
import {
  getDoctorPatientDetail,
  listDoctorAlerts,
  listDoctorReports,
} from "@/lib/doctor-detail.functions";
import { DoctorPage } from "@/components/smartneb/doctor-layout";
import { SOSPanel } from "@/components/smartneb/sos-panel";
import { useSignedIn } from "@/components/smartneb/use-signed-in";
import { TimeSlotsField } from "@/components/smartneb/time-slots-field";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { StatusBadge, VitalCard, freshness, type VitalStatus } from "@/components/smartneb/vitals";
import { TrendChart } from "@/components/smartneb/charts";
import { useT } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/doctor/patients/$patientId")({
  head: () => ({
    meta: [
      { title: "Patient Workspace — SmartNeb Clinician" },
      {
        name: "description",
        content:
          "Clinical workspace with live vitals, trends, alerts, SOS history, care plans, adherence, notes and reports.",
      },
      { property: "og:title", content: "Patient Workspace — SmartNeb Clinician" },
      {
        property: "og:description",
        content:
          "Live vitals, therapy adherence, care plans and clinical notes for one assigned patient.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DoctorPatientDetailPage,
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
function today() {
  return new Date().toISOString().slice(0, 10);
}

function DoctorPatientDetailPage() {
  const t = useT();
  const { patientId } = useParams({ from: "/_authenticated/doctor/patients/$patientId" });
  const signedIn = useSignedIn() === true;

  const detail = useQuery({
    queryKey: ["doctor-detail", patientId],
    queryFn: () => getDoctorPatientDetail({ data: { patientId } }),
    enabled: signedIn,
    retry: false,
  });

  const snapshot = useQuery({
    queryKey: ["snapshot", patientId],
    queryFn: () => getPatientSnapshot({ data: { patientId } }),
    enabled: signedIn,
    retry: false,
    refetchInterval: signedIn ? 5_000 : false,
  });

  return (
    <DoctorPage
      title={detail.data?.patient.full_name ?? t("doctor.patients.workspaceFallback")}
      subtitle={
        detail.data
          ? t("doctor.patients.mrnCondition", {
              mrn: detail.data.patient.mrn,
              condition: detail.data.patient.condition ?? t("doctor.patients.noCondition"),
            })
          : t("doctor.patients.loadingRecord")
      }

      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/doctor/patients">
            <ArrowLeft className="mr-2 size-4" aria-hidden /> {t("doctor.patients.roster")}
          </Link>
        </Button>
      }
    >
      {() =>
        detail.isPending ? (
          <LoadingSkeleton rows={4} />
        ) : detail.isError ? (
          <ErrorState message={(detail.error as Error)?.message} onRetry={() => detail.refetch()} />
        ) : (
          <Workspace
            patientId={patientId}
            detail={detail.data}
            snapshot={snapshot.data}
            signedIn={signedIn}
          />
        )
      }
    </DoctorPage>
  );
}

function Workspace({
  patientId,
  detail,
  snapshot,
  signedIn,
}: {
  patientId: string;
  detail: NonNullable<Awaited<ReturnType<typeof getDoctorPatientDetail>>>;
  snapshot: Awaited<ReturnType<typeof getPatientSnapshot>> | undefined;
  signedIn: boolean;
}) {
  const t = useT();
  const p = detail.patient;
  const spo2 = snapshot?.health?.spo2 == null ? null : Number(snapshot.health.spo2);
  const bpm = snapshot?.health?.bpm == null ? null : Number(snapshot.health.bpm);
  const temp =
    snapshot?.health?.body_temperature == null ? null : Number(snapshot.health.body_temperature);
  const fresh = freshness(snapshot?.health?.recorded_at ?? null);

  return (
    <div className="space-y-6">
      <section className="panel flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{p.full_name}</h2>
          <p className="text-sm text-muted-foreground">
            {t("doctor.workspace.identityLine", {
              mrn: p.mrn,
              sex: p.sex ?? "—",
              dob: p.date_of_birth ?? "—",
              device: detail.device?.device_code ?? t("doctor.patients.noDevice"),
            })}
          </p>
          {detail.contact ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("doctor.workspace.contactLine", {
                email: detail.contact.email ?? t("doctor.patients.noEmail"),
                phone: detail.contact.phone ?? t("doctor.patients.noPhone"),
              })}
            </p>
          ) : null}
          {detail.caregivers.length ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("doctor.patients.caregivers", {
                list: detail.caregivers.map((cg) => `${cg.full_name} (${cg.relation})`).join(", "),
              })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={fresh.stale ? "unknown" : "normal"}
            label={
              fresh.stale
                ? t("doctor.workspace.stale", { text: fresh.text })
                : t("doctor.workspace.live", { text: fresh.text })
            }
          />
          <CarePlanDialog patientId={patientId} />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <VitalCard
          label={t("doctor.vitals.oxygenSaturation")}
          value={spo2 ?? null}
          unit="%"
          status={spo2Status(spo2, p.spo2_threshold)}
          hint={t("doctor.vitals.threshold", { value: p.spo2_threshold })}
          icon={<Activity className="size-4" aria-hidden />}
        />
        <VitalCard
          label={t("doctor.vitals.heartRate")}
          value={bpm ?? null}
          unit="bpm"
          status={bpmStatus(bpm, p.bpm_low_threshold, p.bpm_high_threshold)}
          hint={t("doctor.vitals.range", { low: p.bpm_low_threshold, high: p.bpm_high_threshold })}
          icon={<HeartPulse className="size-4" aria-hidden />}
        />
        <VitalCard
          label={t("doctor.vitals.bodyTemperature")}
          value={temp == null ? null : temp.toFixed(1)}
          unit="°C"
          status={tempStatus(temp, p.temp_threshold)}
          hint={t("doctor.vitals.max", { value: p.temp_threshold })}
          icon={<Thermometer className="size-4" aria-hidden />}
        />
        <VitalCard
          label={t("doctor.vitals.deviceBattery")}
          value={detail.battery?.percentage ?? null}
          unit="%"
          status={
            detail.battery?.percentage == null
              ? "unknown"
              : detail.battery.percentage < 15
                ? "critical"
                : detail.battery.percentage < 30
                  ? "warning"
                  : "normal"
          }
          hint={
            detail.battery?.charging ? t("doctor.vitals.charging") : t("doctor.vitals.onBattery")
          }
          icon={<BatteryCharging className="size-4" aria-hidden />}
        />
      </div>

      <section className="panel p-5">
        <h3 className="font-display text-sm font-semibold">{t("doctor.workspace.deviceStatus")}</h3>
        <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-4">
          <div className="rounded-lg border bg-surface-2 p-3">
            <dt className="text-muted-foreground">{t("doctor.workspace.connectivity")}</dt>
            <dd className="mt-1 font-medium">
              {detail.device
                ? t("doctor.workspace.connectivityValue", {
                    status: detail.device.status,
                    mqtt: detail.device.mqtt_connected
                      ? t("doctor.workspace.up")
                      : t("doctor.workspace.down"),
                    cloud: detail.device.cloud_connected
                      ? t("doctor.workspace.up")
                      : t("doctor.workspace.down"),
                  })
                : t("doctor.workspace.noDeviceAssigned")}
            </dd>
          </div>
          <div className="rounded-lg border bg-surface-2 p-3">
            <dt className="text-muted-foreground">{t("doctor.workspace.nebulizer")}</dt>
            <dd className="mt-1 font-medium">{detail.device?.nebulizer_state ?? "—"}</dd>
          </div>
          <div className="rounded-lg border bg-surface-2 p-3">
            <dt className="text-muted-foreground">{t("doctor.workspace.chamberFluid")}</dt>
            <dd className="mt-1 font-medium tabular-nums">
              {detail.device ? `${Math.round(detail.device.fluid_level)}%` : "—"}
            </dd>
          </div>
          <div className="rounded-lg border bg-surface-2 p-3">
            <dt className="text-muted-foreground">{t("doctor.workspace.lastSeen")}</dt>
            <dd className="mt-1 font-medium">
              {detail.device?.last_seen_at
                ? new Date(detail.device.last_seen_at).toLocaleString()
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <SOSPanel
        patientId={patientId}
        enabled={signedIn}
        includeResolved
        title={t("doctor.sos.emergencyHistory")}
      />

      <Tabs defaultValue="trends">
        <TabsList className="flex-wrap">
          <TabsTrigger value="trends">{t("doctor.tabs.trends")}</TabsTrigger>
          <TabsTrigger value="alerts">{t("doctor.tabs.alerts")}</TabsTrigger>
          <TabsTrigger value="plans">{t("doctor.tabs.carePlans")}</TabsTrigger>
          <TabsTrigger value="adherence">{t("doctor.tabs.adherence")}</TabsTrigger>
          <TabsTrigger value="notes">{t("doctor.tabs.clinicalNotes")}</TabsTrigger>
          <TabsTrigger value="reports">{t("doctor.tabs.reports")}</TabsTrigger>
        </TabsList>
        <TabsContent value="trends" className="mt-4">
          <TrendsPanel patientId={patientId} signedIn={signedIn} />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <AlertsPanel patientId={patientId} signedIn={signedIn} />
        </TabsContent>
        <TabsContent value="plans" className="mt-4">
          <CarePlanList patientId={patientId} />
        </TabsContent>
        <TabsContent value="adherence" className="mt-4">
          <AdherencePanel patientId={patientId} signedIn={signedIn} />
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <NotesPanel patientId={patientId} signedIn={signedIn} />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportsPanel patientId={patientId} signedIn={signedIn} />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">{t("app.disclaimer")}</p>
    </div>
  );
}

function TrendsPanel({ patientId, signedIn }: { patientId: string; signedIn: boolean }) {
  const t = useT();
  const [minutes, setMinutes] = useState(1440);
  const series = useQuery({
    queryKey: ["doctor-series", patientId, minutes],
    queryFn: () => getTelemetrySeries({ data: { patientId, minutes } }),
    enabled: signedIn,
    retry: false,
    refetchInterval: signedIn ? 15_000 : false,
  });

  const health = (series.data?.health ?? []).map((h: any) => ({
    t: h.recorded_at,
    spo2: h.spo2 == null ? null : Number(h.spo2),
    bpm: h.bpm == null ? null : Number(h.bpm),
    temp: h.body_temperature == null ? null : Number(h.body_temperature),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          [60, t("time.range.1h")],
          [360, t("time.range.6h")],
          [1440, t("time.range.24h")],
          [10080, t("time.range.7d")],
        ].map(([m, label]) => (
          <Button
            key={String(m)}
            size="sm"
            variant={minutes === m ? "default" : "outline"}
            onClick={() => setMinutes(Number(m))}
          >
            {label}
          </Button>
        ))}
      </div>
      {series.isPending ? (
        <LoadingSkeleton rows={2} />
      ) : health.length === 0 ? (
        <EmptyState
          title={t("doctor.trends.noTelemetry")}
          description={t("doctor.trends.pickLonger")}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="panel p-5">
            <h4 className="font-display text-sm font-semibold">
              {t("doctor.vitals.oxygenSaturation")}
            </h4>
            <TrendChart
              data={health}
              area
              series={[{ key: "spo2", label: "SpO₂ %", color: "var(--color-vital)" }]}
            />
          </div>
          <div className="panel p-5">
            <h4 className="font-display text-sm font-semibold">
              {t("doctor.trends.heartRateTemp")}
            </h4>
            <TrendChart
              data={health}
              series={[
                { key: "bpm", label: "Heart rate", color: "var(--color-critical)" },
                { key: "temp", label: "Temp °C", color: "var(--color-warn)" },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AlertsPanel({ patientId, signedIn }: { patientId: string; signedIn: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const alerts = useQuery({
    queryKey: ["doctor-alerts", patientId, true],
    queryFn: () => listDoctorAlerts({ data: { patientId, includeResolved: true } }),
    enabled: signedIn,
    retry: false,
  });
  const respond = useMutation({
    mutationFn: (v: { alertId: string; resolve?: boolean }) => acknowledgeAlert({ data: v }),
    onSuccess: () => {
      toast.success(t("doctor.alerts.updated"));
      void qc.invalidateQueries({ queryKey: ["doctor-alerts"] });
      void qc.invalidateQueries({ queryKey: ["doctor-patients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (alerts.isPending) return <LoadingSkeleton rows={3} />;
  if (!alerts.data?.length)
    return (
      <EmptyState
        title={t("doctor.alerts.noAlerts")}
        description={t("doctor.alerts.noAlertsDesc")}
      />
    );

  return (
    <ul className="space-y-2">
      {alerts.data.map((a) => (
        <li
          key={a.id}
          className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{a.message}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("doctor.alerts.detailLine", {
                type: a.type,
                value: a.value ?? "--",
                threshold: a.threshold ?? "--",
                date: new Date(a.created_at).toLocaleString(),
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            <Badge variant="outline">{a.status}</Badge>
            {a.status === "active" ? (
              <Button size="sm" variant="outline" onClick={() => respond.mutate({ alertId: a.id })}>
                {t("doctor.alerts.acknowledge")}
              </Button>
            ) : null}
            {a.status !== "resolved" ? (
              <Button size="sm" onClick={() => respond.mutate({ alertId: a.id, resolve: true })}>
                {t("doctor.alerts.resolve")}
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function AdherencePanel({ patientId, signedIn }: { patientId: string; signedIn: boolean }) {
  const t = useT();
  const adherence = useQuery({
    queryKey: ["doctor-adherence", patientId],
    queryFn: () => getAdherence({ data: { patientId, days: 30 } }),
    enabled: signedIn,
    retry: false,
  });
  const sessions = useQuery({
    queryKey: ["doctor-sessions", patientId],
    queryFn: () => listSessions({ data: { patientId, limit: 20 } }),
    enabled: signedIn,
    retry: false,
  });

  if (adherence.isPending || sessions.isPending) return <LoadingSkeleton rows={3} />;

  const records = (adherence.data as any)?.records ?? (adherence.data as any) ?? [];
  const list = Array.isArray(records) ? records : [];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="panel p-5">
        <h4 className="font-display text-sm font-semibold">{t("doctor.adherence.title")}</h4>
        {list.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("doctor.adherence.noRecords")}</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {list.slice(0, 15).map((r: any) => (
              <li key={r.id ?? r.scheduled_for} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{r.scheduled_for}</span>
                <Badge
                  variant={
                    r.status === "completed"
                      ? "secondary"
                      : r.status === "missed"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {r.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="panel p-5">
        <h4 className="font-display text-sm font-semibold">
          {t("doctor.adherence.recentSessions")}
        </h4>
        {(sessions.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("doctor.adherence.noSessions")}</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {(sessions.data ?? []).map((s: any) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  {t("doctor.adherence.sessionLine", {
                    date: new Date(s.started_at).toLocaleString(),
                    medication: s.medication ?? "—",
                  })}
                </span>
                <span className="tabular-nums">
                  {t("doctor.adherence.sessionProgress", {
                    percent: Math.round(
                      (s.elapsed_seconds / Math.max(1, s.prescribed_seconds)) * 100,
                    ),
                    status: s.status,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NotesPanel({ patientId, signedIn }: { patientId: string; signedIn: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const notes = useQuery({
    queryKey: ["clinical-notes", patientId],
    queryFn: () => listClinicalNotes({ data: { patientId } }),
    enabled: signedIn,
    retry: false,
  });
  const add = useMutation({
    mutationFn: () => addClinicalNote({ data: { patientId, note: note.trim() } }),
    onSuccess: () => {
      toast.success(t("doctor.notes.saved"));
      setNote("");
      void qc.invalidateQueries({ queryKey: ["clinical-notes", patientId] });
      void qc.invalidateQueries({ queryKey: ["doctor-notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <form
        className="panel space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (note.trim().length < 2) {
            toast.error(t("doctor.validation.writeNoteFirst"));
            return;
          }
          add.mutate();
        }}
      >
        <Label htmlFor="clinical-note">{t("doctor.notes.newNote")}</Label>
        <Textarea
          id="clinical-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={t("doctor.notes.notePlaceholder")}
        />
        <Button type="submit" size="sm" disabled={add.isPending}>
          {t("doctor.notes.saveNote")}
        </Button>
      </form>

      {notes.isPending ? (
        <LoadingSkeleton rows={2} />
      ) : !notes.data?.length ? (
        <EmptyState
          title={t("doctor.notes.emptyTitle")}
          description={t("doctor.notes.emptyDesc")}
        />
      ) : (
        <ul className="space-y-2">
          {notes.data.map((n: any) => (
            <li key={n.id} className="panel p-4">
              <p className="text-sm whitespace-pre-wrap">{n.note}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportsPanel({ patientId, signedIn }: { patientId: string; signedIn: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const [days, setDays] = useState(7);
  const reports = useQuery({
    queryKey: ["doctor-reports", patientId],
    queryFn: () => listDoctorReports({ data: { patientId } }),
    enabled: signedIn,
    retry: false,
  });
  const generate = useMutation({
    mutationFn: () => buildReport({ data: { patientId, days } }),
    onSuccess: () => {
      toast.success(t("doctor.reports.generated"));
      void qc.invalidateQueries({ queryKey: ["doctor-reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <Label htmlFor="report-days" className="text-sm">
          {t("doctor.reports.rangeDays")}
        </Label>
        <Input
          id="report-days"
          type="number"
          min={1}
          max={180}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-9 w-24"
        />
        <Button size="sm" disabled={generate.isPending} onClick={() => generate.mutate()}>
          {t("doctor.reports.generateClinical")}
        </Button>
      </div>

      {reports.isPending ? (
        <LoadingSkeleton rows={2} />
      ) : !reports.data?.length ? (
        <EmptyState
          title={t("doctor.reports.emptyTitle")}
          description={t("doctor.reports.emptyDesc")}
        />
      ) : (
        <ul className="space-y-2">
          {reports.data.map((r) => (
            <li key={r.id} className="panel px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  {t("doctor.reports.kindLine", {
                    kind: r.kind,
                    date: new Date(r.created_at).toLocaleString(),
                  })}
                </p>
                <Badge variant="outline">
                  {r.mine ? t("doctor.reports.requestedByYou") : t("doctor.reports.careTeam")}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("doctor.reports.summaryLine", {
                  samples: r.summary.samples ?? 0,
                  avgSpo2: r.summary.avgSpo2 ?? "--",
                  minSpo2: r.summary.minSpo2 ?? "--",
                  avgBpm: r.summary.avgBpm ?? "--",
                  alerts: r.summary.alerts ?? 0,
                  sessions: r.summary.sessions ?? 0,
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CarePlanList({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const plans = useQuery({
    queryKey: ["care-plans", patientId],
    queryFn: () => listCarePlans({ data: { patientId } }),
  });
  const status = useMutation({
    mutationFn: (v: { planId: string; status: "published" | "paused" | "ended" }) =>
      setCarePlanStatus({ data: v }),
    onSuccess: () => {
      toast.success("Care plan updated");
      void qc.invalidateQueries({ queryKey: ["care-plans", patientId] });
      void qc.invalidateQueries({ queryKey: ["doctor-care-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (plans.isPending) return <LoadingSkeleton rows={2} />;
  if (!plans.data?.length)
    return (
      <EmptyState
        title="No care plans yet"
        description="Create a nebulization plan to define medication, dosage and daily frequency."
      />
    );

  return (
    <ul className="space-y-3">
      {plans.data.map((plan: any) => (
        <li key={plan.id} className="panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-sm font-semibold">
                {plan.medication} · {plan.dosage}
              </p>
              <p className="text-xs text-muted-foreground">
                {plan.duration_minutes} min · {plan.frequency_per_day}x daily · from{" "}
                {plan.start_date}
                {plan.end_date ? ` to ${plan.end_date}` : ""}
              </p>
              {plan.time_slots?.length ? (
                <p className="text-xs text-muted-foreground">
                  Times: {plan.time_slots.join(" · ")}
                </p>
              ) : null}
              {plan.instructions ? (
                <p className="mt-2 text-sm text-muted-foreground">{plan.instructions}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={plan.status === "published" ? "default" : "secondary"}>
                {plan.status}
              </Badge>
              {plan.status !== "published" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => status.mutate({ planId: plan.id, status: "published" })}
                >
                  Publish
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => status.mutate({ planId: plan.id, status: "paused" })}
                >
                  Pause
                </Button>
              )}
              {plan.status !== "ended" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => status.mutate({ planId: plan.id, status: "ended" })}
                >
                  End
                </Button>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CarePlanDialog({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    medication: "",
    dosage: "",
    durationMinutes: 10,
    frequencyPerDay: 2,
    instructions: "",
    startDate: today(),
    endDate: "",
    timeSlots: [] as string[],
  });

  const create = useMutation({
    mutationFn: () =>
      createCarePlan({
        data: {
          patientId,
          medication: form.medication.trim(),
          dosage: form.dosage.trim(),
          durationMinutes: Number(form.durationMinutes),
          frequencyPerDay: Number(form.frequencyPerDay),
          instructions: form.instructions.trim() || undefined,
          startDate: form.startDate,
          endDate: form.endDate || null,
          timeSlots: form.timeSlots,
          publish: true,
        },
      }),
    onSuccess: () => {
      toast.success("Care plan published to the patient");
      setOpen(false);
      setForm((f) => ({ ...f, medication: "", dosage: "", instructions: "" }));
      void qc.invalidateQueries({ queryKey: ["care-plans", patientId] });
      void qc.invalidateQueries({ queryKey: ["doctor-care-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <ClipboardPlus className="mr-2 size-4" aria-hidden /> New care plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create nebulization care plan</DialogTitle>
          <DialogDescription>
            The patient is notified as soon as the plan is published.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.medication.trim() || !form.dosage.trim()) {
              toast.error("Medication and dosage are required");
              return;
            }
            create.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="medication">Medication</Label>
              <Input
                id="medication"
                value={form.medication}
                onChange={(e) => setForm({ ...form, medication: e.target.value })}
                placeholder="Salbutamol"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dosage">Dosage</Label>
              <Input
                id="dosage"
                value={form.dosage}
                onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                placeholder="2.5 mg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                max={120}
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frequency">Times per day</Label>
              <Input
                id="frequency"
                type="number"
                min={1}
                max={12}
                value={form.frequencyPerDay}
                onChange={(e) => setForm({ ...form, frequencyPerDay: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End date (optional)</Label>
              <Input
                id="endDate"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <TimeSlotsField
              value={form.timeSlots}
              onChange={(t) => setForm((f) => ({ ...f, timeSlots: t }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              rows={3}
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="Sit upright, breathe slowly through the mouthpiece…"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              Publish plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
