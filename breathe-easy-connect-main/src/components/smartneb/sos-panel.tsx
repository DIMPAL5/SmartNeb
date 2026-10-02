import { useEffect, useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Siren } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listSOSEvents, respondToSOS, type SOSEventRow } from "@/lib/sos.functions";
import { StatusBadge } from "./vitals";
import { EmptyState, LoadingSkeleton } from "./states";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

export function useSOSEvents({
  patientId,
  enabled = true,
  includeResolved = false,
}: {
  patientId?: string | undefined;
  enabled?: boolean;
  includeResolved?: boolean;
}) {
  const qc = useQueryClient();
  const instanceId = useId();
  const key = ["sos-events", patientId ?? "all", includeResolved] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      listSOSEvents({
        data: { ...(patientId ? { patientId } : {}), includeResolved },
      }),
    enabled,
    retry: false,
    refetchInterval: enabled ? 10_000 : false,
  });

  // Realtime: an SOS must surface without waiting for the poll interval.
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`sos-stream-${patientId ?? "all"}-${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_events" }, () => {
        void qc.invalidateQueries({ queryKey: ["sos-events"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, patientId, qc, instanceId]);

  return query;
}

function fmtVital(v: unknown, unit: string) {
  if (v == null) return "--";
  return `${Number(v)}${unit}`;
}

export function SOSCard({
  event,
  canRespond = true,
}: {
  event: SOSEventRow;
  canRespond?: boolean;
}) {
  const t = useT();
  const qc = useQueryClient();
  const respond = useMutation({
    mutationFn: (action: "acknowledge" | "resolve") =>
      respondToSOS({ data: { sosId: event.id, action } }),
    onSuccess: (_r, action) => {
      toast.success(action === "resolve" ? t("patient.sos.resolved") : t("patient.sos.acknowledged"));
      void qc.invalidateQueries({ queryKey: ["sos-events"] });
      void qc.invalidateQueries({ queryKey: ["caregiver-patients"] });
      void qc.invalidateQueries({ queryKey: ["doctor-patients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const live = event.status !== "resolved";

  return (
    <li
      className={`rounded-xl border p-4 ${
        event.status === "active" ? "border-critical/60 bg-critical/5" : "bg-surface-2"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {live ? <span className="live-dot" aria-hidden /> : null}
            <p className="font-display text-sm font-semibold">
              {event.patientName} · {event.mrn}
            </p>
            <StatusBadge
              status={event.severity === "critical" ? "critical" : event.severity === "warning" ? "warning" : "normal"}
              label={event.severity}
            />
            <StatusBadge
              status={event.status === "resolved" ? "normal" : event.status === "acknowledged" ? "warning" : "critical"}
              label={event.status}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {event.condition ?? t("patient.sos.noCondition")} · {t("patient.sos.viaSource", { source: event.source })} ·{" "}
            {new Date(event.created_at).toLocaleString()}
          </p>
        </div>
        {canRespond ? (
          <div className="flex gap-2">
            {event.status === "active" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={respond.isPending}
                onClick={() => respond.mutate("acknowledge")}
              >
                {t("patient.sos.acknowledge")}
              </Button>
            ) : null}
            {event.status !== "resolved" ? (
              <Button size="sm" disabled={respond.isPending} onClick={() => respond.mutate("resolve")}>
                {t("patient.sos.resolve")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-4">
        <div className="rounded-lg border bg-background/60 p-2.5">
          <dt className="text-muted-foreground">{t("patient.sos.spo2AtTrigger")}</dt>
          <dd className="mt-0.5 font-display text-base font-semibold tabular-nums">
            {fmtVital(event.vitals?.spo2, "%")}
          </dd>
        </div>
        <div className="rounded-lg border bg-background/60 p-2.5">
          <dt className="text-muted-foreground">{t("vitals.heartRate")}</dt>
          <dd className="mt-0.5 font-display text-base font-semibold tabular-nums">
            {fmtVital(event.vitals?.bpm, " bpm")}
          </dd>
        </div>
        <div className="rounded-lg border bg-background/60 p-2.5">
          <dt className="text-muted-foreground">{t("patient.sos.temperature")}</dt>
          <dd className="mt-0.5 font-display text-base font-semibold tabular-nums">
            {fmtVital(event.vitals?.body_temperature, " °C")}
          </dd>
        </div>
        <div className="rounded-lg border bg-background/60 p-2.5">
          <dt className="text-muted-foreground">{t("patient.sos.device")}</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {event.deviceCode ?? t("patient.sos.noDevice")}
            <span className="ml-1 text-xs text-muted-foreground">
              ({event.deviceStatus ?? "unknown"})
            </span>
          </dd>
        </div>
      </dl>

      {event.acknowledged_at ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("patient.sos.acknowledgedAt", { date: new Date(event.acknowledged_at).toLocaleString() })}
        </p>
      ) : null}
      {event.resolved_at ? (
        <p className="text-[11px] text-muted-foreground">
          {t("patient.sos.resolvedAt", { date: new Date(event.resolved_at).toLocaleString() })}
        </p>
      ) : null}
    </li>
  );
}

export function SOSPanel({
  patientId,
  enabled = true,
  canRespond = true,
  title,
  includeResolved = false,
}: {
  patientId?: string | undefined;
  enabled?: boolean;
  canRespond?: boolean;
  title?: string;
  includeResolved?: boolean;
}) {
  const t = useT();
  const resolvedTitle = title ?? t("nav.sos");
  const q = useSOSEvents({ patientId, enabled, includeResolved });

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center gap-2">
        <Siren className="size-4 text-critical" aria-hidden />
        <h3 className="font-display text-sm font-semibold">{resolvedTitle}</h3>
        {(q.data ?? []).some((e) => e.status === "active") ? (
          <span className="rounded-full bg-critical px-2 py-0.5 text-[11px] font-semibold text-critical-foreground">
            {t("patient.sos.activeCount", { count: (q.data ?? []).filter((e) => e.status === "active").length })}
          </span>
        ) : null}
      </div>
      {q.isLoading ? (
        <LoadingSkeleton rows={1} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          title={t("patient.sos.noneTitle")}
          description={t("patient.sos.noneDesc")}
          icon={<Siren className="size-5" />}
        />
      ) : (
        <ul className="space-y-3">
          {(q.data ?? []).map((e) => (
            <SOSCard key={e.id} event={e} canRespond={canRespond} />
          ))}
        </ul>
      )}
    </section>
  );
}
