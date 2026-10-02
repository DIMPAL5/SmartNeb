import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { addCaregiverNote, listCaregiverNotes } from "@/lib/caregiver-detail.functions";
import { CaregiverPage } from "@/components/smartneb/caregiver-layout";
import { useSignedIn } from "@/components/smartneb/use-signed-in";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/caregiver/notes")({
  head: () => ({
    meta: [
      { title: "Caregiver Notes — SmartNeb" },
      {
        name: "description",
        content: "Record and review day-to-day observations for the patients in your care.",
      },
      { property: "og:title", content: "Caregiver Notes — SmartNeb" },
      { property: "og:description", content: "Observations logged by the care team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CareNotesPage,
});

function CareNotesPage() {
  const t = useT();
  const signedIn = useSignedIn() === true;
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState<string>("");
  const [note, setNote] = useState("");

  const notes = useQuery({
    queryKey: ["caregiver-notes", "all"],
    queryFn: () => listCaregiverNotes({ data: {} }),
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
    <CaregiverPage title={t("nav.notes")} subtitle={t("caregiver.notesSubtitle")}>
      {({ patients }) => (
        <div className="space-y-5">
          <form
            className="panel space-y-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!patientId || note.trim().length < 2) return;
              add.mutate();
            }}
          >
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
              <NotebookPen className="size-4" aria-hidden /> {t("caregiver.newObservation")}
            </h2>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger aria-label={t("caregiver.selectPatient")}>
                <SelectValue placeholder={t("caregiver.selectAPatient")} />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name} · {p.mrn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={t("caregiver.observationPlaceholder")}
              aria-label={t("caregiver.observation")}
            />
            <Button type="submit" disabled={add.isPending || !patientId || note.trim().length < 2}>
              {add.isPending ? t("caregiver.savingObservation") : t("caregiver.saveObservation")}
            </Button>
          </form>

          {notes.isPending ? (
            <LoadingSkeleton rows={3} />
          ) : notes.isError ? (
            <ErrorState message={(notes.error as Error)?.message} onRetry={() => notes.refetch()} />
          ) : notes.data.length === 0 ? (
            <EmptyState
              title={t("caregiver.noObservationsYet")}
              description={t("caregiver.noObservationsDescription")}
            />
          ) : (
            <ul className="space-y-2">
              {notes.data.map((n) => (
                <li key={n.id} className="panel px-4 py-3">
                  <p className="text-sm">{n.note}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <Link
                      to="/caregiver/patients/$patientId"
                      params={{ patientId: n.patient_id }}
                      className="underline-offset-2 hover:underline"
                    >
                      {n.patientName ?? t("caregiver.patient")}
                    </Link>{" "}
                    · {n.authorName} · {new Date(n.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </CaregiverPage>
  );
}
