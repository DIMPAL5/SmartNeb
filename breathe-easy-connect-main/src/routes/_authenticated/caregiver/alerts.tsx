import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listCareAlerts } from "@/lib/caregiver-detail.functions";
import { CaregiverPage } from "@/components/smartneb/caregiver-layout";
import { useSignedIn } from "@/components/smartneb/use-signed-in";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { StatusBadge } from "@/components/smartneb/vitals";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/caregiver/alerts")({
  head: () => ({
    meta: [
      { title: "Care Alerts — SmartNeb Caregiver" },
      {
        name: "description",
        content: "Active health alerts for the patients assigned to you, with severity and timestamps.",
      },
      { property: "og:title", content: "Care Alerts — SmartNeb Caregiver" },
      { property: "og:description", content: "Severity-ranked alerts across your assigned patients." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CareAlertsPage,
});

function CareAlertsPage() {
  const t = useT();
  const [includeResolved, setIncludeResolved] = useState(false);
  const signedIn = useSignedIn() === true;

  const q = useQuery({
    queryKey: ["care-alerts", includeResolved],
    queryFn: () => listCareAlerts({ data: { includeResolved } }),
    enabled: signedIn,
    retry: false,
    refetchInterval: signedIn ? 15_000 : false,
  });

  return (
    <CaregiverPage
      title={t("nav.alerts")}
      subtitle={t("caregiver.alertsSubtitle")}
      actions={
        <Button variant="outline" size="sm" onClick={() => setIncludeResolved((v) => !v)}>
          {includeResolved ? t("caregiver.hideResolved") : t("caregiver.showResolved")}
        </Button>
      }
    >
      {() =>
        q.isPending ? (
          <LoadingSkeleton rows={4} />
        ) : q.isError ? (
          <ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} />
        ) : q.data.length === 0 ? (
          <EmptyState title={t("caregiver.noAlerts")} description={t("caregiver.noAlertsDescription")} />
        ) : (
          <ul className="space-y-2">
            {q.data.map((a) => (
              <li
                key={a.id}
                className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.message}</p>
                  <p className="text-xs text-muted-foreground">
                    <Link
                      to="/caregiver/patients/$patientId"
                      params={{ patientId: a.patient_id }}
                      className="underline-offset-2 hover:underline"
                    >
                      {a.patientName} · {a.mrn}
                    </Link>{" "}
                    · {a.type} · {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    status={
                      a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "normal"
                    }
                    label={a.severity}
                  />
                  <StatusBadge status={a.status === "resolved" ? "normal" : "unknown"} label={a.status} />
                </div>
              </li>
            ))}
          </ul>
        )
      }
    </CaregiverPage>
  );
}
