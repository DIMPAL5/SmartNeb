import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { listDoctorNotes } from "@/lib/doctor-detail.functions";
import { addClinicalNote } from "@/lib/doctor.functions";
import { DoctorPage } from "@/components/smartneb/doctor-layout";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/doctor/notes")({
  head: () => ({
    meta: [
      { title: "Clinical Notes — SmartNeb Clinician" },
      {
        name: "description",
        content:
          "Longitudinal clinical documentation across every assigned SmartNeb patient, searchable and time-stamped.",
      },
      { property: "og:title", content: "Clinical Notes — SmartNeb Clinician" },
      {
        property: "og:description",
        content: "Write and review time-stamped clinical notes for your respiratory patients.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DoctorNotesPage,
});

function DoctorNotesPage() {
  const t = useT();
  const [q, setQ] = useState("");
  const [patientId, setPatientId] = useState("");
  const [note, setNote] = useState("");

  return (
    <DoctorPage title={t("doctor.notes.title")} subtitle={t("doctor.notes.subtitle")}>
      {({ patients, signedIn }) => {
        const qc = useQueryClient();
        const notes = useQuery({
          queryKey: ["doctor-notes"],
          queryFn: () => listDoctorNotes(),
          enabled: signedIn,
          retry: false,
        });
        const add = useMutation({
          mutationFn: () => addClinicalNote({ data: { patientId, note: note.trim() } }),
          onSuccess: () => {
            toast.success(t("doctor.notes.saved"));
            setNote("");
            void qc.invalidateQueries({ queryKey: ["doctor-notes"] });
            void qc.invalidateQueries({ queryKey: ["clinical-notes"] });
          },
          onError: (e: Error) => toast.error(e.message),
        });

        const rows = useMemo(() => {
          const needle = q.trim().toLowerCase();
          return (notes.data ?? []).filter((n) =>
            needle
              ? n.note.toLowerCase().includes(needle) ||
                n.patientName.toLowerCase().includes(needle) ||
                n.mrn.toLowerCase().includes(needle)
              : true,
          );
        }, [notes.data, q]);

        return (
          <div className="space-y-5">
            <form
              className="panel space-y-3 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!patientId) {
                  toast.error(t("doctor.validation.choosePatient"));
                  return;
                }
                if (note.trim().length < 2) {
                  toast.error(t("doctor.validation.writeNoteFirst"));
                  return;
                }
                add.mutate();
              }}
            >
              <h2 className="font-display text-sm font-semibold">{t("doctor.notes.newNote")}</h2>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,260px)_1fr]">
                <div className="space-y-1.5">
                  <Label htmlFor="note-patient">{t("doctor.field.patient")}</Label>
                  <Select value={patientId} onValueChange={setPatientId}>
                    <SelectTrigger id="note-patient">
                      <SelectValue placeholder={t("doctor.patients.selectPatient")} />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name} · {p.mrn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note-body">{t("doctor.notes.noteLabel")}</Label>
                  <Textarea
                    id="note-body"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("doctor.notes.notePlaceholder")}
                  />
                </div>
              </div>
              <Button type="submit" size="sm" disabled={add.isPending}>
                {t("doctor.notes.saveNote")}
              </Button>
            </form>

            <div className="panel flex items-center gap-2 p-4">
              <Search className="size-4 text-muted-foreground" aria-hidden />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("doctor.notes.searchPlaceholder")}
                aria-label={t("doctor.notes.searchAria")}
                className="h-9"
              />
            </div>

            {notes.isPending ? (
              <LoadingSkeleton rows={3} />
            ) : notes.isError ? (
              <ErrorState message={(notes.error as Error)?.message} onRetry={() => notes.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState title={t("doctor.notes.emptyTitle")} description={t("doctor.notes.emptyDesc")} />
            ) : (
              <ul className="space-y-2">
                {rows.map((n) => (
                  <li key={n.id} className="panel p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        to="/doctor/patients/$patientId"
                        params={{ patientId: n.patient_id }}
                        className="text-sm font-semibold underline-offset-4 hover:underline"
                      >
                        {n.patientName} · {n.mrn}
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge variant={n.mine ? "secondary" : "outline"}>
                          {n.mine ? t("doctor.notes.you") : (n.doctorName ?? t("doctor.notes.careTeam"))}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(n.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-wrap">{n.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }}
    </DoctorPage>
  );
}
