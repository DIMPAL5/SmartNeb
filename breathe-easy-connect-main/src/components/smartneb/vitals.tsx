import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

export type VitalStatus = "normal" | "warning" | "critical" | "unknown";

const statusStyles: Record<VitalStatus, string> = {
  normal: "bg-vital/12 text-vital border-vital/30",
  warning: "bg-warn/15 text-warn border-warn/35",
  critical: "bg-critical/15 text-critical border-critical/40",
  unknown: "bg-muted text-muted-foreground border-border",
};

const statusLabelKey: Record<VitalStatus, string> = {
  normal: "patient.vitalStatus.normal",
  warning: "patient.vitalStatus.warning",
  critical: "patient.vitalStatus.critical",
  unknown: "patient.vitalStatus.unknown",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: VitalStatus;
  label?: string;
  className?: string;
}) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full bg-current",
          status === "critical" || status === "warning" ? "live-dot" : "",
        )}
      />
      {label ?? t(statusLabelKey[status])}
    </span>
  );
}

export function VitalCard({
  label,
  value,
  unit,
  status = "unknown",
  trend,
  hint,
  icon,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  status?: VitalStatus;
  trend?: number | null;
  hint?: string;
  icon?: ReactNode;
}) {
  const t = useT();
  const TrendIcon =
    trend == null || Math.abs(trend) < 0.01 ? ArrowRight : trend > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="panel group relative overflow-hidden p-5 transition-shadow hover:shadow-glow">
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-0.5",
          status === "critical"
            ? "bg-critical"
            : status === "warning"
              ? "bg-warn"
              : status === "normal"
                ? "bg-vital"
                : "bg-border",
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-semibold tabular-nums">
          {value ?? "--"}
        </span>
        {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        {trend != null ? (
          <span className="inline-flex items-center gap-1">
            <TrendIcon className="size-3.5" aria-hidden />
            {t("patient.vitals.vsPrevious", { value: `${trend > 0 ? "+" : ""}${trend.toFixed(1)}` })}
          </span>
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </div>
    </div>
  );
}

export function Gauge({
  value,
  label,
  unit = "%",
  status = "normal",
  size = 128,
}: {
  value: number | null;
  label: string;
  unit?: string;
  status?: VitalStatus;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const stroke =
    status === "critical"
      ? "var(--critical)"
      : status === "warning"
        ? "var(--warn)"
        : "var(--primary)";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`${label}: ${value ?? "unknown"}${unit}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          className="fill-foreground font-display text-xl font-semibold"
        >
          {value == null ? "--" : Math.round(pct)}
          {unit}
        </text>
        <text x="50%" y="64%" textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {label}
        </text>
      </svg>
    </div>
  );
}

export function freshness(iso?: string | null, now: number = Date.now()) {
  if (!iso) return { seconds: Infinity, text: "no data", stale: true };
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  const text =
    seconds < 60
      ? `${seconds}s ago`
      : seconds < 3600
        ? `${Math.round(seconds / 60)} min ago`
        : `${Math.round(seconds / 3600)} h ago`;
  return { seconds, text, stale: seconds > 90 };
}
