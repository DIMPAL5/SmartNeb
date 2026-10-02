import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { acknowledgeAlert, listAlerts } from "@/lib/smartneb.functions";
import { PatientPage } from "@/components/smartneb/patient-layout";
import { StatusBadge } from "@/components/smartneb/vitals";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/patient/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — SmartNeb" },
      {
        name: "description",
        content: "Review, acknowledge and resolve threshold alerts raised by your SmartNeb device.",
      },
      { property: "og:title", content: "Alerts — SmartNeb" },
      {
        property: "og:description",
        content: "Every threshold breach and device warning in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const t = useT();
  return (
    <PatientPage title={t("nav.alerts")} subtitle={t("patient.alerts.subtitle")}>
      {({ patientId }) => <AlertsBody patientId={patientId} />}
    </PatientPage>
  );
}

function AlertsBody({ patientId }: { patientId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["alerts", patientId],
    queryFn: () => listAlerts({ data: { patientId } }),
    refetchInterval: 15_000,
  });

  const ack = useMutation({
    mutationFn: (vars: { alertId: string; resolve?: boolean }) => acknowledgeAlert({ data: vars }),
    onSuccess: () => {
      toast.success(t("patient.alerts.updated"));
      void qc.invalidateQueries({ queryKey: ["alerts", patientId] });
      void qc.invalidateQueries({ queryKey: ["snapshot", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <LoadingSkeleton rows={4} />;
  if (q.isError || !q.data)
    return <ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} />;
  if (q.data.length === 0)
    return (
      <EmptyState
        title={t("patient.alerts.noneTitle")}
        description={t("patient.alerts.noneDesc")}
      />
    );

  return (
    <ul className="space-y-3">
      {q.data.map((a) => (
        <li key={a.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
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
              <p className="text-sm font-medium">{a.message}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {a.type} · {new Date(a.created_at).toLocaleString()} · {a.status}
            </p>
          </div>
          <div className="flex gap-2">
            {a.status === "active" ? (
              <Button size="sm" variant="outline" onClick={() => ack.mutate({ alertId: a.id })}>
                {t("patient.sos.acknowledge")}
              </Button>
            ) : null}
            {a.status !== "resolved" ? (
              <Button size="sm" onClick={() => ack.mutate({ alertId: a.id, resolve: true })}>
                {t("patient.sos.resolve")}
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
