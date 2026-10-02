import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type SeriesPoint = Record<string, number | string | null>;

const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

function fmtTime(v: string) {
  const d = new Date(v);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TrendChart({
  data,
  series,
  domain,
  height = 260,
  area = false,
}: {
  data: SeriesPoint[];
  series: Array<{ key: string; label: string; color: string }>;
  domain?: [number | "auto", number | "auto"];
  height?: number;
  area?: boolean;
}) {
  const Chart = area ? AreaChart : LineChart;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="t" tickFormatter={fmtTime} minTickGap={40} {...axisProps} />
          <YAxis domain={domain ?? ["auto", "auto"]} {...axisProps} width={44} />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
            labelFormatter={(v) => new Date(String(v)).toLocaleString()}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) =>
            area ? (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

export const RANGES = [
  { label: "5m", key: "time.range.5m", minutes: 5 },
  { label: "15m", key: "time.range.15m", minutes: 15 },
  { label: "1h", key: "time.range.1h", minutes: 60 },
  { label: "6h", key: "time.range.6h", minutes: 360 },
  { label: "24h", key: "time.range.24h", minutes: 1440 },
  { label: "7d", key: "time.range.7d", minutes: 10080 },
  { label: "30d", key: "time.range.30d", minutes: 43200 },
] as const;
