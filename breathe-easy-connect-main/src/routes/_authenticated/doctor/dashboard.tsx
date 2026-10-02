import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ClipboardPlus,
  HeartPulse,
  NotebookPen,
  Search,
  Thermometer,
  Wind,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPatientSnapshot } from "@/lib/smartneb.functions";
import {
  addClinicalNote,
  createCarePlan,
  listCarePlans,
  listClinicalNotes,
  listMyPatients,
  setCarePlanStatus,
  type DoctorPatientRow,
} from "@/lib/doctor.functions";
import { AppShell, doctorNav } from "@/components/smartneb/app-shell";
import { SOSPanel } from "@/components/smartneb/sos-panel";
import { useMe } from "@/components/smartneb/patient-layout";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { StatusBadge, VitalCard, freshness, type VitalStatus } from "@/components/smartneb/vitals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/doctor/dashboard")({
  head: () => ({
    meta: [
      { title: "Clinical Dashboard — SmartNeb" },
      {
        name: "description",
        content:
          "Monitor assigned respiratory patients in real time, review live vitals and publish nebulization care plans.",
      },
      { property: "og:title", content: "Clinical Dashboard — SmartNeb" },
      {
        property: "og:description",
        content: "Live vitals, adherence and care plan management for assigned patients.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DoctorDashboard,
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

function DoctorDashboard() {
  const t = useT();
  const me = useMe();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [signedIn, setSignedIn] = useState(true);

  // Stop polling/refetching the moment the session goes away, otherwise
  // protected server functions are called without a bearer token.
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
    queryKey: ["doctor-patients"],
    queryFn: () => listMyPatients(),
    enabled: signedIn,
    retry: false,
    refetchInterval: signedIn ? 15_000 : false,
  });

  useEffect(() => {
    if (!selected && roster.data?.length) setSelected(roster.data[0]!.id);
  }, [roster.data, selected]);

  // Live database stream: any new vitals, alert or session pushes a refresh.
  useEffect(() => {
    if (!signedIn) return;
    const channel = supabase
      .channel("doctor-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "health_telemetry" }, () => {
        queryClient.invalidateQueries({ queryKey: ["doctor-patients"] });
        queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["doctor-patients"] });
        queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nebulization_sessions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["doctor-patients"] });
          queryClient.invalidateQueries({ queryKey: ["snapshot"] });
        },
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
      (a, b) => b.criticalAlerts - a.criticalAlerts || b.activeAlerts - a.activeAlerts,
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

  const critical = (roster.data ?? []).reduce((n, p) => n + p.criticalAlerts, 0);
  const inTherapy = (roster.data ?? []).filter((p) => p.sessionStatus === "running").length;

  return (
    <AppShell
      me={me.data}
      nav={doctorNav}
      title={t("doctor.dashboard.title")}
      subtitle={t("doctor.dashboard.subtitle", {
        count: roster.data?.length ?? 0,
        critical,
        inTherapy,
      })}
    >
      {!me.data.doctorId ? (
        <ErrorState message={t("doctor.noClinicianRecord")} />
      ) : (
        <div className="space-y-6">
          <SOSPanel enabled={signedIn} title={t("doctor.sos.assignedPatients")} />
          <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
            <section className="panel flex max-h-[calc(100vh-11rem)] flex-col p-4">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-muted-foreground" aria-hidden />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("doctor.patients.searchPlaceholder")}
                  aria-label={t("doctor.patients.searchAria")}
                  className="h-9"
                />
              </div>
              <ScrollArea className="mt-3 flex-1">
                {roster.isLoading ? (
                  <LoadingSkeleton rows={4} />
                ) : patients.length === 0 ? (
                  <EmptyState
                    title={t("doctor.patients.noAssigned")}
                    description={t("doctor.patients.noAssignedDesc")}
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
                title={t("doctor.patients.selectPatient")}
                description={t("doctor.patients.selectPatientDesc")}
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
  patient: DoctorPatientRow;
  active: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  const s = spo2Status(patient.spo2, patient.spo2_threshold);
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
            {patient.mrn} · {patient.condition ?? t("doctor.patients.noCondition")}
          </p>
        </div>
        <StatusBadge status={s} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">SpO₂ {patient.spo2 ?? "--"}%</span>
        <span className="tabular-nums">HR {patient.bpm ?? "--"}</span>
        <span>{fresh.text}</span>
        {patient.sessionStatus === "running" ? (
          <Badge variant="secondary" className="gap-1">
            <Wind className="size-3" /> {t("doctor.patients.inTherapy")}
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
  patient: DoctorPatientRow | null;
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
  const spo2 = snap?.health?.spo2 == null ? null : Number(snap.health.spo2);
  const bpm = snap?.health?.bpm == null ? null : Number(snap.health.bpm);
  const temp = snap?.health?.body_temperature == null ? null : Number(snap.health.body_temperature);
  const prevSpo2 = snap?.healthPrev?.spo2 == null ? null : Number(snap.healthPrev.spo2);
  const prevBpm = snap?.healthPrev?.bpm == null ? null : Number(snap.healthPrev.bpm);
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
            {p?.full_name ?? patient?.full_name ?? t("doctor.patients.fallbackName")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {p?.mrn ?? patient?.mrn} · {p?.condition ?? t("doctor.patients.noCondition")} ·{" "}
            {patient?.deviceCode ?? t("doctor.patients.noDevice")}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {snapshot.isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <VitalCard
            label={t("doctor.vitals.oxygenSaturation")}
            value={spo2 ?? null}
            unit="%"
            status={spo2Status(spo2, spo2Min)}
            trend={spo2 != null && prevSpo2 != null ? spo2 - prevSpo2 : null}
            hint={t("doctor.vitals.threshold", { value: spo2Min })}
            icon={<Activity className="size-4" aria-hidden />}
          />
          <VitalCard
            label={t("doctor.vitals.heartRate")}
            value={bpm ?? null}
            unit="bpm"
            status={bpmStatus(bpm, bpmLow, bpmHigh)}
            trend={bpm != null && prevBpm != null ? bpm - prevBpm : null}
            hint={t("doctor.vitals.range", { low: bpmLow, high: bpmHigh })}
            icon={<HeartPulse className="size-4" aria-hidden />}
          />
          <VitalCard
            label={t("doctor.vitals.bodyTemperature")}
            value={temp == null ? null : temp.toFixed(1)}
            unit="°C"
            status={tempStatus(temp, tempMax)}
            hint={t("doctor.vitals.max", { value: tempMax })}
            icon={<Thermometer className="size-4" aria-hidden />}
          />
        </div>
      )}

      {(snap?.activeAlerts ?? []).length > 0 ? (
        <div className="panel p-5">
          <h3 className="font-display text-sm font-semibold">{t("doctor.profile.activeAlerts")}</h3>
          <ul className="mt-3 space-y-2">
            {(snap?.activeAlerts ?? []).map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <span>{a.message}</span>
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
        </div>
      ) : null}

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">{t("doctor.tabs.carePlans")}</TabsTrigger>
          <TabsTrigger value="notes">{t("doctor.tabs.clinicalNotes")}</TabsTrigger>
        </TabsList>
        <TabsContent value="plans" className="mt-4">
          <CarePlanList patientId={patientId} />
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <NotesPanel patientId={patientId} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function CarePlanList({ patientId }: { patientId: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const plans = useQuery({
    queryKey: ["care-plans", patientId],
    queryFn: () => listCarePlans({ data: { patientId } }),
  });
  const status = useMutation({
    mutationFn: (v: { planId: string; status: "published" | "paused" | "ended" }) =>
      setCarePlanStatus({ data: v }),
    onSuccess: () => {
      toast.success(t("doctor.carePlans.updated"));
      void queryClient.invalidateQueries({ queryKey: ["care-plans", patientId] });
      void queryClient.invalidateQueries({ queryKey: ["snapshot", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (plans.isLoading) return <LoadingSkeleton rows={3} />;
  if (!plans.data?.length)
    return (
      <EmptyState
        title={t("doctor.carePlans.noPlansYet")}
        description={t("doctor.carePlans.noPlansYetDesc")}
      />
    );

  return (
    <ul className="space-y-3">
      {plans.data.map((plan) => (
        <li key={plan.id} className="panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-sm font-semibold">
                {plan.medication} · {plan.dosage}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("doctor.carePlans.durationDaily", {
                  duration: plan.duration_minutes,
                  freq: plan.frequency_per_day,
                  start: plan.start_date,
                })}
                {plan.end_date ? t("doctor.carePlans.toDate", { end: plan.end_date }) : ""}
              </p>
              {plan.instructions ? (
                <p className="mt-2 text-sm text-muted-foreground">{plan.instructions}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={plan.status === "published" ? "default" : "secondary"}>
                {plan.status}
              </Badge>
              {plan.status !== "published" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => status.mutate({ planId: plan.id, status: "published" })}
                >
                  {t("doctor.carePlans.publish")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => status.mutate({ planId: plan.id, status: "paused" })}
                >
                  {t("doctor.carePlans.pause")}
                </Button>
              )}
              {plan.status !== "ended" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => status.mutate({ planId: plan.id, status: "ended" })}
                >
                  {t("doctor.carePlans.end")}
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
  const t = useT();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    medication: "",
    dosage: "",
    durationMinutes: 10,
    frequencyPerDay: 2,
    instructions: "",
    startDate: today(),
    endDate: "",
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
          publish: true,
        },
      }),
    onSuccess: () => {
      toast.success(t("doctor.carePlans.publishedToPatient"));
      setOpen(false);
      setForm((f) => ({ ...f, medication: "", dosage: "", instructions: "" }));
      void queryClient.invalidateQueries({ queryKey: ["care-plans", patientId] });
      void queryClient.invalidateQueries({ queryKey: ["snapshot", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <ClipboardPlus className="mr-2 size-4" /> {t("doctor.carePlans.newCarePlan")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("doctor.carePlans.createTitle")}</DialogTitle>
          <DialogDescription>{t("doctor.carePlans.createDesc")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.medication.trim() || !form.dosage.trim()) {
              toast.error(t("doctor.carePlans.medicationDosageRequired"));
              return;
            }
            create.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="medication">{t("doctor.field.medication")}</Label>
              <Input
                id="medication"
                value={form.medication}
                onChange={(e) => setForm({ ...form, medication: e.target.value })}
                placeholder={t("doctor.placeholder.medication")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dosage">{t("doctor.field.dosage")}</Label>
              <Input
                id="dosage"
                value={form.dosage}
                onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                placeholder={t("doctor.placeholder.dosage")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="duration">{t("doctor.field.durationMinutes")}</Label>
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
              <Label htmlFor="frequency">{t("doctor.field.dosesPerDay")}</Label>
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
              <Label htmlFor="start">{t("doctor.field.startDate")}</Label>
              <Input
                id="start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">{t("doctor.field.endDateOptional")}</Label>
              <Input
                id="end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="instructions">{t("doctor.field.instructions")}</Label>
            <Textarea
              id="instructions"
              rows={3}
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder={t("doctor.placeholder.instructions")}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending
                ? t("doctor.carePlans.publishing")
                : t("doctor.carePlans.publishPlan")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NotesPanel({ patientId }: { patientId: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const notes = useQuery({
    queryKey: ["clinical-notes", patientId],
    queryFn: () => listClinicalNotes({ data: { patientId } }),
  });
  const add = useMutation({
    mutationFn: () => addClinicalNote({ data: { patientId, note: note.trim() } }),
    onSuccess: () => {
      setNote("");
      toast.success(t("doctor.notes.savedShort"));
      void queryClient.invalidateQueries({ queryKey: ["clinical-notes", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-4">
        <Label htmlFor="clinical-note" className="flex items-center gap-2">
          <NotebookPen className="size-4" aria-hidden /> {t("doctor.notes.addNote")}
        </Label>
        <Textarea
          id="clinical-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("doctor.notes.workspacePlaceholder")}
        />
        <Button
          size="sm"
          disabled={note.trim().length < 2 || add.isPending}
          onClick={() => add.mutate()}
        >
          {add.isPending ? t("doctor.notes.saving") : t("doctor.notes.saveNote")}
        </Button>
      </div>

      {notes.isLoading ? (
        <LoadingSkeleton rows={2} />
      ) : !notes.data?.length ? (
        <EmptyState
          title={t("doctor.notes.emptyTitle")}
          description={t("doctor.notes.emptyDesc")}
        />
      ) : (
        <ul className="space-y-2">
          {notes.data.map((n) => (
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
