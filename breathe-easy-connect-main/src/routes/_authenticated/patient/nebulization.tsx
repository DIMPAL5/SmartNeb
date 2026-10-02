import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listSessions } from "@/lib/smartneb.functions";
import { PatientPage } from "@/components/smartneb/patient-layout";
import { StatusBadge } from "@/components/smartneb/vitals";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/patient/nebulization")({
  head: () => ({
    meta: [
      { title: "Nebulization Sessions — SmartNeb" },
      {
        name: "description",
        content:
          "Full history of your nebulization sessions with duration, medication and completion state.",
      },
      { property: "og:title", content: "Nebulization Sessions — SmartNeb" },
      {
        property: "og:description",
        content: "Review every therapy session logged by your device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <NebulizationRoute />,
});

function NebulizationRoute() {
  const t = useT();
  return (
    <PatientPage title={t("nav.nebulization")} subtitle={t("patient.nebulization.subtitle")}>
      {({ patientId }) => <SessionsBody patientId={patientId} />}
    </PatientPage>
  );
}

function mmss(s: number) {
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function SessionsBody({ patientId }: { patientId: string }) {
  const t = useT();
  const q = useQuery({
    queryKey: ["sessions", patientId],
    queryFn: () => listSessions({ data: { patientId, limit: 100 } }),
  });

  if (q.isLoading) return <LoadingSkeleton rows={4} />;
  if (q.isError || !q.data)
    return <ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} />;
  if (q.data.length === 0)
    return (
      <EmptyState
        title={t("patient.nebulization.noneTitle")}
        description={t("patient.nebulization.noneDesc")}
      />
    );

  return (
    <div className="panel overflow-x-auto p-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">{t("patient.nebulization.colStarted")}</th>
            <th className="px-4 py-3">{t("patient.nebulization.colMedication")}</th>
            <th className="px-4 py-3">{t("patient.nebulization.colDuration")}</th>
            <th className="px-4 py-3">{t("patient.nebulization.colPrescribed")}</th>
            <th className="px-4 py-3">{t("patient.nebulization.colStatus")}</th>
          </tr>
        </thead>
        <tbody>
          {q.data.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="px-4 py-3">{new Date(s.started_at).toLocaleString()}</td>
              <td className="px-4 py-3">
                {s.medication ?? "--"}
                {s.dosage ? ` · ${s.dosage}` : ""}
              </td>
              <td className="px-4 py-3 tabular-nums">{mmss(s.elapsed_seconds ?? 0)}</td>
              <td className="px-4 py-3 tabular-nums">{mmss(s.prescribed_seconds ?? 0)}</td>
              <td className="px-4 py-3">
                <StatusBadge
                  status={
                    s.status === "completed"
                      ? "normal"
                      : s.status === "failed"
                        ? "critical"
                        : s.status === "running"
                          ? "normal"
                          : "warning"
                  }
                  label={s.status}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
