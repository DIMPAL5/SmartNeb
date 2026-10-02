import type { ReactNode } from "react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Siren } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMyPatients, type DoctorPatientRow } from "@/lib/doctor.functions";
import { AppShell, doctorNav } from "./app-shell";
import { useMe } from "./patient-layout";
import { useSignedIn } from "./use-signed-in";
import { ErrorState, LoadingSkeleton } from "./states";
import { useSOSEvents } from "./sos-panel";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/i18n";

export type { DoctorPatientRow };

/** Assigned-patient roster + live invalidation for every doctor route. */
export function useDoctorPatients() {
  const signedIn = useSignedIn();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["doctor-patients"],
    queryFn: () => listMyPatients(),
    enabled: signedIn === true,
    retry: false,
    refetchInterval: signedIn === true ? 15_000 : false,
  });

  useEffect(() => {
    if (signedIn !== true) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["doctor-patients"] });
      void queryClient.invalidateQueries({ queryKey: ["doctor-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["doctor-detail"] });
      void queryClient.invalidateQueries({ queryKey: ["snapshot"] });
    };
    const channel = supabase
      .channel("doctor-portal-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "health_telemetry" },
        invalidate,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, invalidate)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nebulization_sessions" },
        invalidate,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_events" }, invalidate)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, signedIn]);

  return query;
}

function DoctorIndicators({ patients }: { patients: DoctorPatientRow[] }) {
  const t = useT();
  const signedIn = useSignedIn() === true;
  const sos = useSOSEvents({ enabled: signedIn });
  const activeSOS = (sos.data ?? []).filter((e) => e.status !== "resolved").length;
  const critical = patients.reduce((n, p) => n + p.criticalAlerts, 0);
  if (!activeSOS && !critical) return null;
  return (
    <div className="mr-1 flex items-center gap-1.5">
      {activeSOS > 0 ? (
        <Badge
          variant="destructive"
          className="gap-1"
          aria-label={t("doctor.activeEmergenciesAria", { count: activeSOS })}
        >
          <Siren className="size-3" aria-hidden /> {activeSOS} {t("doctor.sosBadge")}
        </Badge>
      ) : null}
      {critical > 0 ? (
        <Badge
          variant="destructive"
          className="gap-1"
          aria-label={t("doctor.criticalAlertsAria", { count: critical })}
        >
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

/** Shell for every doctor route: role gate, sidebar, live indicators. */
function NoClinicianRecord() {
  const t = useT();
  return <ErrorState message={t("doctor.noClinicianRecord")} />;
}

export function DoctorPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: (ctx: {
    patients: DoctorPatientRow[];
    isLoading: boolean;
    signedIn: boolean;
  }) => ReactNode;
}) {
  const me = useMe();
  const signedIn = useSignedIn() === true;
  const roster = useDoctorPatients();

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
  const isDoctor = me.data.role === "doctor" && Boolean(me.data.doctorId);

  return (
    <AppShell
      me={me.data}
      nav={doctorNav}
      title={title}
      subtitle={subtitle}
      actions={
        <>
          <DoctorIndicators patients={patients} />
          {actions}
        </>
      }
    >
      {isDoctor ? (
        <PageSlot render={children} ctx={{ patients, isLoading: roster.isLoading, signedIn }} />
      ) : (
        <NoClinicianRecord />
      )}
    </AppShell>
  );
}
