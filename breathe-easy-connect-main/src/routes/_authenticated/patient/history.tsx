import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getTelemetrySeries, listAlerts, listSessions } from "@/lib/smartneb.functions";
import { PatientPage } from "@/components/smartneb/patient-layout";
import { TrendChart } from "@/components/smartneb/charts";
import { StatusBadge } from "@/components/smartneb/vitals";
import { ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/patient/history")({
  head: () => ({
    meta: [
      { title: "Health History — SmartNeb" },
      {
        name: "description",
        content: "A 7-day timeline of your vitals, therapy sessions and clinical alerts in one view.",
      },
      { property: "og:title", content: "Health History — SmartNeb" },
      { property: "og:description", content: "Your weekly respiratory health timeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PatientPageWrapper />
  ),
});

function PatientPageWrapper() {
  const t = useT();
  return (
    <PatientPage title={t("nav.healthHistory")} subtitle={t("patient.history.subtitle")}>
      {({ patientId }) => <HistoryBody patientId={patientId} />}
    </PatientPage>
  );
}

function HistoryBody({ patientId }: { patientId: string }) {
  const t = useT();
  const series = useQuery({
    queryKey: ["series", patientId, 10080],
    queryFn: () => getTelemetrySeries({ data: { patientId, minutes: 10080 } }),
  });
  const sessions = useQuery({
    queryKey: ["sessions", patientId],
    queryFn: () => listSessions({ data: { patientId, limit: 20 } }),
  });
  const alerts = useQuery({
    queryKey: ["alerts", patientId],
    queryFn: () => listAlerts({ data: { patientId } }),
  });

  if (series.isLoading) return <LoadingSkeleton rows={4} />;
  if (series.isError || !series.data)
    return <ErrorState message={(series.error as Error)?.message} onRetry={() => series.refetch()} />;

  const data = series.data.health.map((r) => ({
    t: r.recorded_at,
    bpm: r.bpm == null ? null : Number(r.bpm),
    spo2: r.spo2 == null ? null : Number(r.spo2),
  }));

  const timeline = [
    ...(sessions.data ?? []).map((s) => ({
      id: `s-${s.id}`,
      at: s.started_at,
      title: t("patient.history.nebulizationStatus", { status: s.status }),
      detail: t("patient.history.sessionDetail", {
        medication: s.medication ?? "Session",
        minutes: Math.round((s.elapsed_seconds ?? 0) / 60),
      }),
      tone: s.status === "completed" ? "normal" : s.status === "failed" ? "critical" : "warning",
    })),
    ...(alerts.data ?? []).map((a) => ({
      id: `a-${a.id}`,
      at: a.created_at,
      title: t("patient.history.severityAlert", { severity: a.severity }),
      detail: a.message,
      tone: a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "normal",
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <p className="mb-3 font-display text-sm font-semibold">{t("patient.history.weeklyVitals")}</p>
        <TrendChart
          data={data}
          series={[
            { key: "bpm", label: t("patient.history.heartRateSeries"), color: "var(--chart-1)" },
            { key: "spo2", label: t("patient.history.spo2Series"), color: "var(--chart-2)" },
          ]}
        />
      </section>

      <section className="panel p-5">
        <p className="mb-3 font-display text-sm font-semibold">{t("patient.history.timeline")}</p>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("patient.history.nothingRecorded")}</p>
        ) : (
          <ol className="relative space-y-4 border-l pl-6">
            {timeline.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[27px] top-2 size-2.5 rounded-full bg-primary" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{e.title}</p>
                  <StatusBadge status={e.tone as "normal" | "warning" | "critical"} label={new Date(e.at).toLocaleString()} />
                </div>
                <p className="text-xs text-muted-foreground">{e.detail}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
