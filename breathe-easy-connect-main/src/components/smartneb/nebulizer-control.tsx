import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pause, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { startSession, updateSession } from "@/lib/smartneb.functions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "./vitals";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

export type NebState =
  "OFF" | "READY" | "COMMAND_SENT" | "RUNNING" | "PAUSED" | "COMPLETED" | "ERROR";

function chime() {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    [880, 1174].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = f;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.22 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.4);
    });
  } catch {
    /* audio unavailable */
  }
}

type ActiveSession = {
  id: string;
  status: string;
  prescribed_seconds: number;
  elapsed_seconds: number;
  medication: string | null;
  dosage: string | null;
  started_at?: string | null;
  updated_at?: string | null;
} | null;

/** Elapsed seconds restored from the database (survives a browser refresh). */
function restoreElapsed(session: ActiveSession) {
  if (!session) return 0;
  const base = session.elapsed_seconds ?? 0;
  if (session.status !== "running") return base;
  const marker = session.updated_at ?? session.started_at;
  if (!marker) return base;
  const drift = Math.max(0, Math.floor((Date.now() - new Date(marker).getTime()) / 1000));
  return Math.min(session.prescribed_seconds ?? base + drift, base + drift);
}

export function NebulizerControl({
  patientId,
  session,
  deviceOnline,
  medication,
  dosage,
  prescribedMinutes,
  compact = false,
  onRelay,
}: {
  patientId: string;
  session: ActiveSession;
  deviceOnline: boolean;
  medication?: string | null;
  dosage?: string | null;
  prescribedMinutes: number;
  compact?: boolean;
  /** Physical relay actuation on the real device (Firebase → ESP32). */
  onRelay?: (on: boolean) => Promise<void>;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [elapsed, setElapsed] = useState(() => restoreElapsed(session));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const prescribed = session?.prescribed_seconds ?? prescribedMinutes * 60;
  const simulated = !deviceOnline;

  /** Drive the real relay; never claim success when the write fails. */
  const relay = async (on: boolean) => {
    if (!onRelay || !deviceOnline) return;
    try {
      await onRelay(on);
    } catch (e) {
      toast.error(t("patient.neb.relayFailed", { message: (e as Error).message }));
    }
  };

  const state: NebState = !session
    ? deviceOnline
      ? "READY"
      : "OFF"
    : session.status === "starting"
      ? "COMMAND_SENT"
      : session.status === "running"
        ? "RUNNING"
        : session.status === "paused"
          ? "PAUSED"
          : session.status === "failed"
            ? "ERROR"
            : "COMPLETED";

  useEffect(() => {
    setElapsed(restoreElapsed(session));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.status, session?.elapsed_seconds, session?.updated_at]);

  const update = useMutation({
    mutationFn: (vars: {
      action: "ack" | "heartbeat" | "pause" | "resume" | "stop" | "complete";
      elapsedSeconds: number;
      sessionId?: string;
    }) =>
      updateSession({
        data: {
          sessionId: vars.sessionId ?? session?.id ?? "",
          action: vars.action,
          elapsedSeconds: vars.elapsedSeconds,
        },
      }),
    onSuccess: (_d, vars) => {
      if (vars.action === "heartbeat") return;
      if (vars.action === "resume") void relay(true);
      if (vars.action === "pause" || vars.action === "stop" || vars.action === "complete")
        void relay(false);
      void qc.invalidateQueries({ queryKey: ["snapshot", patientId] });
      void qc.invalidateQueries({ queryKey: ["sessions", patientId] });
      void qc.invalidateQueries({ queryKey: ["adherence", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const start = useMutation({
    mutationFn: () => startSession({ data: { patientId } }),
    onSuccess: async (res) => {
      const newId = res.session.id;
      if (deviceOnline && onRelay) {
        await relay(true);
        toast.success(t("patient.neb.relayOnSent"));
      } else if (res.simulated) {
        toast.warning(t("patient.neb.simulatedStarted"), {
          description: t("patient.neb.simulatedStartedDesc"),
        });
      } else {
        toast.success(t("patient.neb.startCommandSent"));
      }
      // Device acknowledgement (ESP32 publishes back over MQTT). Simulated locally when unavailable.
      await update.mutateAsync({ action: "ack", elapsedSeconds: 0, sessionId: newId });
      void qc.invalidateQueries({ queryKey: ["snapshot", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (state !== "RUNNING") {
      if (timer.current) clearInterval(timer.current);
      return;
    }
    timer.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= prescribed) {
          chime();
          toast.success(t("patient.neb.sessionComplete"));
          update.mutate({ action: "complete", elapsedSeconds: prescribed });
          return prescribed;
        }
        // Persist progress so a refresh restores the timer accurately.
        if (next % 15 === 0) update.mutate({ action: "heartbeat", elapsedSeconds: next });
        return next;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, prescribed]);

  const pct = prescribed ? Math.min(100, (elapsed / prescribed) * 100) : 0;
  const size = compact ? 150 : 210;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const mmss = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const statusTone =
    state === "RUNNING" ? "normal" : state === "ERROR" || state === "OFF" ? "critical" : "warning";

  return (
    <div className="panel flex flex-col items-center gap-5 p-6">
      <div className="flex w-full items-center justify-between">
        <div>
          <p className="font-display text-sm font-semibold">{t("vitals.nebulizer")}</p>
          <p className="text-xs text-muted-foreground">
            {medication ?? t("patient.neb.noMedication")}
            {dosage ? ` · ${dosage}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {simulated ? <StatusBadge status="warning" label={t("patient.neb.simulated")} /> : null}
          <StatusBadge status={statusTone} label={state.replace("_", " ")} />
        </div>
      </div>

      <svg
        width={size}
        height={size}
        role="img"
        aria-label={t("patient.neb.sessionProgressAria", { pct: Math.round(pct) })}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={12}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 900ms linear" }}
          className={cn(state === "RUNNING" && "drop-shadow-[0_0_10px_var(--glow)]")}
        />
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          className="fill-foreground font-display text-3xl font-semibold tabular-nums"
        >
          {mmss(Math.max(0, prescribed - elapsed))}
        </text>
        <text x="50%" y="60%" textAnchor="middle" className="fill-muted-foreground text-[11px]">
          {t("patient.neb.ofDuration", { elapsed: mmss(elapsed), prescribed: mmss(prescribed) })}
        </text>
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {state === "READY" || state === "OFF" || state === "COMPLETED" || state === "ERROR" ? (
          <Button onClick={() => setConfirmOpen(true)} disabled={start.isPending}>
            {start.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Play className="mr-2 size-4" />
            )}
            {t("patient.neb.startSession")}
          </Button>
        ) : null}
        {state === "RUNNING" ? (
          <Button
            variant="secondary"
            onClick={() => update.mutate({ action: "pause", elapsedSeconds: elapsed })}
          >
            <Pause className="mr-2 size-4" /> {t("patient.neb.pause")}
          </Button>
        ) : null}
        {state === "PAUSED" ? (
          <Button onClick={() => update.mutate({ action: "resume", elapsedSeconds: elapsed })}>
            <Play className="mr-2 size-4" /> {t("patient.neb.resume")}
          </Button>
        ) : null}
        {state === "RUNNING" || state === "PAUSED" || state === "COMMAND_SENT" ? (
          <Button
            variant="destructive"
            onClick={() => update.mutate({ action: "stop", elapsedSeconds: elapsed })}
          >
            <Square className="mr-2 size-4" /> {t("patient.neb.stop")}
          </Button>
        ) : null}
      </div>

      {simulated ? (
        <p className="text-center text-xs text-warn">{t("patient.neb.offlineSimulatorNote")}</p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {t("patient.neb.stateReflectsNote")}
        </p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("patient.neb.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {medication ? `${medication}${dosage ? ` · ${dosage}` : ""} — ` : ""}
              {t("patient.neb.minuteSession", { minutes: Math.round(prescribed / 60) })}
              {simulated ? t("patient.neb.confirmSimulatedNote") : t("patient.neb.confirmLiveNote")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("action.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                start.mutate();
              }}
            >
              {t("patient.neb.startSession")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
