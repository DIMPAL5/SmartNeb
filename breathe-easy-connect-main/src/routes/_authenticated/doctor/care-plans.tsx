import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import {
  listDoctorCarePlans,
  updateCarePlanDetails,
  type DoctorCarePlanRow,
} from "@/lib/doctor-detail.functions";
import { setCarePlanStatus } from "@/lib/doctor.functions";
import { DoctorPage } from "@/components/smartneb/doctor-layout";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimeSlotsField } from "@/components/smartneb/time-slots-field";
import { useT } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/doctor/care-plans")({
  head: () => ({
    meta: [
      { title: "Care Plans — SmartNeb Clinician" },
      {
        name: "description",
        content:
          "Review, edit, publish and pause nebulization care plans for every patient assigned to you.",
      },
      { property: "og:title", content: "Care Plans — SmartNeb Clinician" },
      {
        property: "og:description",
        content: "Manage medication, dosage, duration and daily frequency across your patient panel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DoctorCarePlansPage,
});

type StatusFilter = "all" | "published" | "draft" | "paused" | "ended";

function DoctorCarePlansPage() {
  const t = useT();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<DoctorCarePlanRow | null>(null);

  const statusLabels: Record<StatusFilter, string> = {
    all: t("doctor.carePlans.status.all"),
    published: t("doctor.carePlans.status.published"),
    draft: t("doctor.carePlans.status.draft"),
    paused: t("doctor.carePlans.status.paused"),
    ended: t("doctor.carePlans.status.ended"),
  };

  return (
    <DoctorPage title={t("doctor.carePlans.title")} subtitle={t("doctor.carePlans.subtitle")}>
      {({ signedIn }) => {
        const qc = useQueryClient();
        const plans = useQuery({
          queryKey: ["doctor-care-plans"],
          queryFn: () => listDoctorCarePlans(),
          enabled: signedIn,
          retry: false,
        });
        const status = useMutation({
          mutationFn: (v: { planId: string; status: "published" | "paused" | "ended" }) =>
            setCarePlanStatus({ data: v }),
          onSuccess: () => {
            toast.success(t("doctor.carePlans.updated"));
            void qc.invalidateQueries({ queryKey: ["doctor-care-plans"] });
            void qc.invalidateQueries({ queryKey: ["care-plans"] });
          },
          onError: (e: Error) => toast.error(e.message),
        });

        const rows = useMemo(
          () => (plans.data ?? []).filter((p) => (filter === "all" ? true : p.status === filter)),
          [plans.data, filter],
        );

        if (plans.isPending) return <LoadingSkeleton rows={4} />;
        if (plans.isError)
          return <ErrorState message={(plans.error as Error)?.message} onRetry={() => plans.refetch()} />;

        return (
          <div className="space-y-4">
            <div className="panel flex flex-wrap items-center gap-2 p-4">
              {(["all", "published", "draft", "paused", "ended"] as StatusFilter[]).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={filter === s ? "default" : "outline"}
                  className="capitalize"
                  onClick={() => setFilter(s)}
                >
                  {statusLabels[s]}
                </Button>
              ))}
            </div>

            {rows.length === 0 ? (
              <EmptyState
                title={t("doctor.carePlans.emptyTitle")}
                description={t("doctor.carePlans.emptyDesc")}
              />
            ) : (
              <ul className="space-y-3">
                {rows.map((plan) => (
                  <li key={plan.id} className="panel p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to="/doctor/patients/$patientId"
                          params={{ patientId: plan.patient_id }}
                          className="font-display text-sm font-semibold underline-offset-4 hover:underline"
                        >
                          {plan.patientName}
                        </Link>
                        <p className="text-xs text-muted-foreground">{plan.mrn}</p>
                        <p className="mt-2 text-sm font-medium">
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
                        {plan.time_slots?.length ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("doctor.carePlans.timesLabel", { slots: plan.time_slots.join(" · ") })}
                          </p>
                        ) : null}
                        {plan.instructions ? (
                          <p className="mt-2 text-sm text-muted-foreground">{plan.instructions}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={plan.status === "published" ? "default" : "secondary"}>
                          {statusLabels[plan.status as StatusFilter] ?? plan.status}
                        </Badge>
                        {!plan.mine ? <Badge variant="outline">{t("doctor.carePlans.anotherClinician")}</Badge> : null}
                        {plan.mine ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setEditing(plan)}>
                              <Pencil className="mr-2 size-3.5" aria-hidden /> {t("doctor.carePlans.edit")}
                            </Button>
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
                          </>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <EditPlanDialog plan={editing} onClose={() => setEditing(null)} />
          </div>
        );
      }}
    </DoctorPage>
  );
}

function EditPlanDialog({ plan, onClose }: { plan: DoctorCarePlanRow | null; onClose: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    medication: "",
    dosage: "",
    durationMinutes: 10,
    frequencyPerDay: 2,
    instructions: "",
    startDate: "",
    endDate: "",
    timeSlots: [] as string[],
  });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (plan && loadedFor !== plan.id) {
    setLoadedFor(plan.id);
    setForm({
      medication: plan.medication,
      dosage: plan.dosage,
      durationMinutes: plan.duration_minutes,
      frequencyPerDay: plan.frequency_per_day,
      instructions: plan.instructions ?? "",
      startDate: plan.start_date,
      endDate: plan.end_date ?? "",
      timeSlots: plan.time_slots ?? [],
    });
  }

  const save = useMutation({
    mutationFn: () =>
      updateCarePlanDetails({
        data: {
          planId: plan!.id,
          medication: form.medication.trim(),
          dosage: form.dosage.trim(),
          durationMinutes: Number(form.durationMinutes),
          frequencyPerDay: Number(form.frequencyPerDay),
          instructions: form.instructions.trim() || null,
          startDate: form.startDate,
          endDate: form.endDate || null,
          timeSlots: form.timeSlots,
        },
      }),
    onSuccess: () => {
      toast.success(t("doctor.carePlans.saved"));
      void qc.invalidateQueries({ queryKey: ["doctor-care-plans"] });
      void qc.invalidateQueries({ queryKey: ["care-plans"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={Boolean(plan)} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("doctor.carePlans.editTitle")}</DialogTitle>
          <DialogDescription>
            {t("doctor.carePlans.editDesc", { name: plan?.patientName ?? t("doctor.carePlans.thePatient") })}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.medication.trim() || !form.dosage.trim()) {
              toast.error(t("doctor.carePlans.medicationDosageRequired"));
              return;
            }
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-medication">{t("doctor.field.medication")}</Label>
              <Input
                id="edit-medication"
                value={form.medication}
                onChange={(e) => setForm({ ...form, medication: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dosage">{t("doctor.field.dosage")}</Label>
              <Input
                id="edit-dosage"
                value={form.dosage}
                onChange={(e) => setForm({ ...form, dosage: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-duration">{t("doctor.field.durationMinutes")}</Label>
              <Input
                id="edit-duration"
                type="number"
                min={1}
                max={120}
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-frequency">{t("doctor.field.timesPerDay")}</Label>
              <Input
                id="edit-frequency"
                type="number"
                min={1}
                max={12}
                value={form.frequencyPerDay}
                onChange={(e) => setForm({ ...form, frequencyPerDay: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-start">{t("doctor.field.startDate")}</Label>
              <Input
                id="edit-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end">{t("doctor.field.endDateOptional")}</Label>
              <Input
                id="edit-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <TimeSlotsField
              id="edit-times"
              value={form.timeSlots}
              onChange={(t) => setForm((f) => ({ ...f, timeSlots: t }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-instructions">{t("doctor.field.instructions")}</Label>
            <Textarea
              id="edit-instructions"
              rows={3}
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("action.cancel")}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {t("doctor.carePlans.saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
