import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { listDoctorReports } from "@/lib/doctor-detail.functions";
import { buildReport } from "@/lib/smartneb.functions";
import { exportReportCSV, exportReportPDF, type SmartNebReport } from "@/lib/report-export";
import { DoctorPage } from "@/components/smartneb/doctor-layout";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/doctor/reports")({
  head: () => ({
    meta: [
      { title: "Clinical Reports — SmartNeb Clinician" },
      {
        name: "description",
        content:
          "Generate and download vitals, adherence and alert summaries for any patient assigned to you.",
      },
      { property: "og:title", content: "Clinical Reports — SmartNeb Clinician" },
      {
        property: "og:description",
        content: "Export SmartNeb clinical summaries covering vitals, therapy sessions and alerts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DoctorReportsPage,
});

function DoctorReportsPage() {
  const t = useT();
  const [patientId, setPatientId] = useState("");
  const [days, setDays] = useState(7);
  const [filterPatient, setFilterPatient] = useState("all");

  return (
    <DoctorPage title={t("doctor.reports.title")} subtitle={t("doctor.reports.subtitle")}>
      {({ patients, signedIn }) => {
        const qc = useQueryClient();
        const reports = useQuery({
          queryKey: ["doctor-reports", "all"],
          queryFn: () => listDoctorReports(),
          enabled: signedIn,
          retry: false,
        });
        const generate = useMutation({
          mutationFn: () => buildReport({ data: { patientId, days: Number(days) } }),
          onSuccess: () => {
            toast.success(t("doctor.reports.generated"));
            void qc.invalidateQueries({ queryKey: ["doctor-reports"] });
          },
          onError: (e: Error) => toast.error(e.message),
        });

        const rows = useMemo(
          () =>
            (reports.data ?? []).filter((r) =>
              filterPatient === "all" ? true : r.patient_id === filterPatient,
            ),
          [reports.data, filterPatient],
        );

        return (
          <div className="space-y-5">
            <form
              className="panel flex flex-wrap items-end gap-3 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!patientId) {
                  toast.error(t("doctor.validation.choosePatient"));
                  return;
                }
                generate.mutate();
              }}
            >
              <div className="min-w-[240px] space-y-1.5">
                <Label htmlFor="report-patient">{t("doctor.field.patient")}</Label>
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger id="report-patient">
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
                <Label htmlFor="report-range">{t("doctor.reports.rangeDays")}</Label>
                <Input
                  id="report-range"
                  type="number"
                  min={1}
                  max={180}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-28"
                />
              </div>
              <Button type="submit" disabled={generate.isPending}>
                <FileText className="mr-2 size-4" aria-hidden /> {t("doctor.reports.generate")}
              </Button>
            </form>

            <div className="panel flex flex-wrap items-center gap-3 p-4">
              <Label htmlFor="report-filter" className="text-sm">
                {t("doctor.reports.filter")}
              </Label>
              <Select value={filterPatient} onValueChange={setFilterPatient}>
                <SelectTrigger id="report-filter" className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("doctor.reports.allPatients")}</SelectItem>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reports.isPending ? (
              <LoadingSkeleton rows={3} />
            ) : reports.isError ? (
              <ErrorState
                message={(reports.error as Error)?.message}
                onRetry={() => reports.refetch()}
              />
            ) : rows.length === 0 ? (
              <EmptyState
                title={t("doctor.reports.emptyTitle")}
                description={t("doctor.reports.emptyDesc")}
              />
            ) : (
              <ul className="space-y-2">
                {rows.map((r) => (
                  <li key={r.id} className="panel px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Link
                        to="/doctor/patients/$patientId"
                        params={{ patientId: r.patient_id }}
                        className="text-sm font-semibold underline-offset-4 hover:underline"
                      >
                        {r.patientName} · {r.mrn}
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{r.kind}</Badge>
                        <Badge variant={r.mine ? "secondary" : "outline"}>
                          {r.mine ? t("doctor.reports.requestedByYou") : t("doctor.reports.careTeam")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => exportReport(r.payload, "pdf", t("doctor.reports.noPayload"))}
                        >
                          <FileDown className="mr-2 size-3.5" aria-hidden /> {t("doctor.reports.pdf")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => exportReport(r.payload, "csv", t("doctor.reports.noPayload"))}
                        >
                          <FileSpreadsheet className="mr-2 size-3.5" aria-hidden /> {t("doctor.reports.csv")}
                        </Button>
                      </div>
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
                      {r.range_start
                        ? t("doctor.reports.summaryRange", {
                            start: new Date(r.range_start).toLocaleDateString(),
                            end: r.range_end
                              ? new Date(r.range_end).toLocaleDateString()
                              : t("doctor.reports.now"),
                          })
                        : ""}
                    </p>
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

function exportReport(payload: unknown, format: "pdf" | "csv", noPayloadMessage: string) {
  if (!payload || typeof payload !== "object") {
    toast.error(noPayloadMessage);
    return;
  }
  try {
    const report = payload as SmartNebReport;
    if (format === "pdf") exportReportPDF(report);
    else exportReportCSV(report);
  } catch (e) {
    toast.error((e as Error).message);
  }
}
