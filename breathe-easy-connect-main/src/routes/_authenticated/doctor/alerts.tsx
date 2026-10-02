import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listDoctorAlerts } from "@/lib/doctor-detail.functions";
import { acknowledgeAlert } from "@/lib/smartneb.functions";
import { DoctorPage } from "@/components/smartneb/doctor-layout";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { StatusBadge } from "@/components/smartneb/vitals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/doctor/alerts")({
  head: () => ({
    meta: [
      { title: "Clinical Alerts — SmartNeb Clinician" },
      {
        name: "description",
        content:
          "Triage desaturation, tachycardia, fever and device alerts across all of your assigned SmartNeb patients.",
      },
      { property: "og:title", content: "Clinical Alerts — SmartNeb Clinician" },
      {
        property: "og:description",
        content: "Acknowledge and resolve threshold breaches across your patient panel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DoctorAlertsPage,
});

type Sev = "all" | "critical" | "warning" | "info";

function DoctorAlertsPage() {
  const t = useT();
  const [sev, setSev] = useState<Sev>("all");
  const [includeResolved, setIncludeResolved] = useState(false);

  const sevLabels: Record<Sev, string> = {
    all: t("doctor.severity.all"),
    critical: t("doctor.severity.critical"),
    warning: t("doctor.severity.warning"),
    info: t("doctor.severity.info"),
  };

  return (
    <DoctorPage title={t("doctor.alerts.title")} subtitle={t("doctor.alerts.subtitle")}>
      {({ signedIn }) => {
        const qc = useQueryClient();
        const alerts = useQuery({
          queryKey: ["doctor-alerts", "all", includeResolved],
          queryFn: () => listDoctorAlerts({ data: { includeResolved } }),
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

        const rows = useMemo(
          () => (alerts.data ?? []).filter((a) => (sev === "all" ? true : a.severity === sev)),
          [alerts.data, sev],
        );

        if (alerts.isPending) return <LoadingSkeleton rows={4} />;
        if (alerts.isError)
          return (
            <ErrorState message={(alerts.error as Error)?.message} onRetry={() => alerts.refetch()} />
          );

        return (
          <div className="space-y-4">
            <div className="panel flex flex-wrap items-center gap-2 p-4">
              {(["all", "critical", "warning", "info"] as Sev[]).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={sev === s ? "default" : "outline"}
                  onClick={() => setSev(s)}
                  className="capitalize"
                >
                  {sevLabels[s]}
                </Button>
              ))}
              <div className="ml-auto">
                <Button
                  size="sm"
                  variant={includeResolved ? "default" : "outline"}
                  onClick={() => setIncludeResolved((v) => !v)}
                >
                  {includeResolved ? t("doctor.alerts.hidingNothing") : t("doctor.alerts.showResolved")}
                </Button>
              </div>
            </div>

            {rows.length === 0 ? (
              <EmptyState
                title={t("doctor.alerts.emptyTitle")}
                description={t("doctor.alerts.emptyDesc")}
              />
            ) : (
              <ul className="space-y-2">
                {rows.map((a) => (
                  <li key={a.id} className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
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
                        <Link
                          to="/doctor/patients/$patientId"
                          params={{ patientId: a.patient_id }}
                          className="text-sm font-semibold underline-offset-4 hover:underline"
                        >
                          {a.patientName}
                        </Link>
                        <span className="text-xs text-muted-foreground">{a.mrn}</span>
                      </div>
                      <p className="mt-1 text-sm">{a.message}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.type} · value {a.value ?? "--"} vs threshold {a.threshold ?? "--"} ·{" "}
                        {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{a.status}</Badge>
                      {a.status === "active" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => respond.mutate({ alertId: a.id })}
                        >
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
            )}
          </div>
        );
      }}
    </DoctorPage>
  );
}
