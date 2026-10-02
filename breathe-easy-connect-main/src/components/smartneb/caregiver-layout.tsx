import type { ReactNode } from "react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Siren } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMyCarePatients, type CaregiverPatientRow } from "@/lib/caregiver.functions";
import { AppShell, caregiverNav } from "./app-shell";
import { useMe } from "./patient-layout";
import { useSignedIn } from "./use-signed-in";
import { ErrorState, LoadingSkeleton } from "./states";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/i18n";

export type { CaregiverPatientRow };

export function useCarePatients() {
  const signedIn = useSignedIn();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["caregiver-patients"],
    queryFn: () => listMyCarePatients(),
    enabled: signedIn === true,
    retry: false,
    refetchInterval: signedIn === true ? 15_000 : false,
  });

  useEffect(() => {
    if (signedIn !== true) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["caregiver-patients"] });
      void queryClient.invalidateQueries({ queryKey: ["care-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["care-detail"] });
    };
    const channel = supabase
      .channel("caregiver-portal-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "health_telemetry" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "nebulization_sessions" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_events" }, invalidate)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, signedIn]);

  return query;
}

function CareIndicators({ patients }: { patients: CaregiverPatientRow[] }) {
  const t = useT();
  const sos = patients.reduce((n, p) => n + p.activeSOS, 0);
  const critical = patients.reduce((n, p) => n + p.criticalAlerts, 0);
  if (!sos && !critical) return null;
  return (
    <div className="mr-1 flex items-center gap-1.5">
      {sos > 0 ? (
        <Badge variant="destructive" className="gap-1" aria-label={t("caregiver.activeEmergenciesAria", { count: sos })}>
          <Siren className="size-3" aria-hidden /> {sos} {t("caregiver.sos")}
        </Badge>
      ) : null}
      {critical > 0 ? (
        <Badge variant="destructive" className="gap-1" aria-label={t("caregiver.criticalAlertsAria", { count: critical })}>
          <AlertTriangle className="size-3" aria-hidden /> {critical}
        </Badge>
      ) : null}
    </div>
  );
}

/**
 * Renders a route's render-prop body inside its own component fiber so pages
 * may safely declare hooks in that callback (hook counts stay per-instance).
 */
function PageSlot<T>({ render, ctx }: { render: (ctx: T) => ReactNode; ctx: T }) {
  return <>{render(ctx)}</>;
}

/** Shell for every caregiver route: role gate, sidebar, live indicators. */
export function CaregiverPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: (ctx: { patients: CaregiverPatientRow[]; isLoading: boolean }) => ReactNode;
}) {
  const t = useT();
  const me = useMe();
  const roster = useCarePatients();

  if (me.isPending) {
    return (
      <div className="p-8">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }
  if (me.isError || !me.data) {
    return (
      <div className="p-8">
        <ErrorState message={(me.error as Error)?.message} onRetry={() => me.refetch()} />
      </div>
    );
  }

  const patients = roster.data ?? [];
  const isCaregiver = me.data.role === "caregiver" && Boolean(me.data.caregiverId);

  return (
    <AppShell
      me={me.data}
      nav={caregiverNav}
      title={title}
      subtitle={subtitle}
      actions={
        <>
          <CareIndicators patients={patients} />
          {actions}
        </>
      }
    >
      {isCaregiver ? (
        <PageSlot render={children} ctx={{ patients, isLoading: roster.isLoading }} />
      ) : (
        <ErrorState message={t("caregiver.noCaregiverRecord")} />
      )}
    </AppShell>
  );
}
