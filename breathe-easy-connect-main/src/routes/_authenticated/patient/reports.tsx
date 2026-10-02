import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { toast } from "sonner";
import { buildReport } from "@/lib/smartneb.functions";
import { exportReportCSV, exportReportPDF, type SmartNebReport } from "@/lib/report-export";
import { PatientPage } from "@/components/smartneb/patient-layout";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/smartneb/states";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/patient/reports")({
  head: () => ({
    meta: [
      { title: "Reports — SmartNeb" },
      {
        name: "description",
        content: "Generate printable clinical summaries of vitals, adherence and therapy sessions.",
      },
      { property: "og:title", content: "Reports — SmartNeb" },
      { property: "og:description", content: "Share a clinical summary with your care team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ReportsRoute />,
});

function ReportsRoute() {
  const t = useT();
  return (
    <PatientPage title={t("nav.reports")} subtitle={t("patient.reports.subtitle")}>
      {({ patientId }) => <ReportsBody patientId={patientId} />}
    </PatientPage>
  );
}

type Report = Awaited<ReturnType<typeof buildReport>>;

function ReportsBody({ patientId }: { patientId: string }) {
  const t = useT();
  const [days, setDays] = useState(7);
  const [report, setReport] = useState<Report | null>(null);

  const gen = useMutation({
    mutationFn: () => buildReport({ data: { patientId, days } }),
    onSuccess: (r) => {
      setReport(r);
      toast.success(t("patient.reports.generated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartneb-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const vitalsStats: Array<[string, number | string | null | undefined, string]> = [
    [t("patient.reports.avgHeartRate"), report?.vitals.avgBpm, "bpm"],
    [t("patient.reports.avgSpo2"), report?.vitals.avgSpo2, "%"],
    [t("patient.reports.lowestSpo2"), report?.vitals.minSpo2, "%"],
    [t("patient.reports.avgTemp"), report?.vitals.avgTemp, "°C"],
  ];

  return (
    <div className="space-y-6">
      <section className="panel flex flex-wrap items-center justify-between gap-4 p-5 print:hidden">
        <div className="flex flex-wrap gap-2">
          {[7, 14, 30, 90].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              onClick={() => setDays(d)}
            >
              {t("patient.reports.lastDays", { days: d })}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => gen.mutate()} disabled={gen.isPending}>
            {gen.isPending ? t("patient.reports.generating") : t("patient.reports.generate")}
          </Button>
          {report ? (
            <>
              <Button variant="outline" onClick={() => exportReportPDF(report as SmartNebReport)}>
                <FileDown className="mr-2 size-4" /> {t("patient.reports.pdf")}
              </Button>
              <Button variant="outline" onClick={() => exportReportCSV(report as SmartNebReport)}>
                <FileSpreadsheet className="mr-2 size-4" /> {t("patient.reports.csv")}
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 size-4" /> {t("patient.reports.print")}
              </Button>
              <Button variant="ghost" onClick={download}>
                {t("patient.reports.rawJson")}
              </Button>
            </>
          ) : null}
        </div>
      </section>

      {gen.isError ? <ErrorState message={(gen.error as Error).message} /> : null}

      {report ? (
        <article className="panel space-y-6 p-8">
          <header className="border-b pb-4">
            <h2 className="font-display text-2xl font-semibold">
              {t("patient.reports.clinicalSummary")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("patient.reports.summaryMeta", {
                name: report.patient?.full_name ?? "",
                mrn: report.patient?.mrn ?? "",
                days: report.rangeDays,
                date: new Date(report.generatedAt).toLocaleString(),
              })}
            </p>
          </header>

          <section className="grid gap-4 sm:grid-cols-4">
            {vitalsStats.map(([k, v, u]) => (
              <div key={String(k)} className="rounded-xl border bg-surface-2 p-4">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
                  {v == null ? "--" : String(v)}
                  <span className="ml-1 text-xs text-muted-foreground">{u}</span>
                </p>
              </div>
            ))}
          </section>

          <section>
            <h3 className="mb-2 font-display text-sm font-semibold">
              {t("patient.reports.carePlanHeading")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {report.carePlan
                ? t("patient.reports.carePlanLine", {
                    medication: report.carePlan.medication,
                    dosage: report.carePlan.dosage ?? "",
                    duration: report.carePlan.duration_minutes,
                    frequency: report.carePlan.frequency_per_day,
                  })
                : t("patient.reports.noCarePlan")}
            </p>
          </section>

          <section>
            <h3 className="mb-2 font-display text-sm font-semibold">
              {t("patient.reports.sessionsHeading", { count: report.sessions.length })}
            </h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {report.sessions.slice(0, 12).map((s) => (
                <li key={s.id}>
                  {t("patient.reports.sessionLine", {
                    date: new Date(s.started_at).toLocaleString(),
                    status: s.status,
                    minutes: Math.round((s.elapsed_seconds ?? 0) / 60),
                  })}
                </li>
              ))}
              {report.sessions.length === 0 ? <li>{t("patient.reports.noSessions")}</li> : null}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-display text-sm font-semibold">
              {t("patient.reports.alertsHeading", { count: report.alerts.length })}
            </h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {report.alerts.slice(0, 12).map((a) => (
                <li key={a.id}>
                  {t("patient.reports.alertLine", {
                    date: new Date(a.created_at).toLocaleString(),
                    severity: a.severity,
                    message: a.message,
                  })}
                </li>
              ))}
              {report.alerts.length === 0 ? <li>{t("patient.reports.noAlerts")}</li> : null}
            </ul>
          </section>

          <footer className="border-t pt-4 text-xs text-muted-foreground">
            {t("patient.reports.footerNote")}
          </footer>
        </article>
      ) : (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          {t("patient.reports.choosePrompt")}
        </div>
      )}
    </div>
  );
}
