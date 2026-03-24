"use client";

import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface MetricCardProps {
  title: string;
  unit?: string;
  value: string;
  subtitle?: string;
  color: string;
  secondColor?: string;
  history: number[];
  secondHistory?: number[];
  legend?: [string, string];
  max?: number;
  large?: boolean;
}

function formatTime(secondsAgo: number) {
  const m = Math.floor(secondsAgo / 60);
  const s = secondsAgo % 60;
  if (m > 0) return `-${m}m${s > 0 ? `${s}s` : ""}`;
  return `-${s}s`;
}

export function MetricCard({
  title,
  unit,
  value,
  subtitle,
  color,
  secondColor,
  history,
  secondHistory,
  legend,
  max,
  large,
}: MetricCardProps) {
  const totalPoints = history.length;
  const data = history.map((v, i) => ({
    idx: i,
    timeLabel: formatTime(totalPoints - 1 - i),
    primary: v,
    ...(secondHistory ? { secondary: secondHistory[i] } : {}),
  }));

  const chartHeight = large ? 180 : 64;
  const ChartComponent = large ? LineChart : AreaChart;

  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="text-xs font-medium text-foreground">
          {title}
          {unit && <span className="text-muted-foreground font-normal"> ({unit})</span>}
        </div>
        {!large && (
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-lg font-semibold font-mono" style={{ color }}>
              {value}
            </span>
            {subtitle && (
              <span className="text-[10px] text-muted-foreground">{subtitle}</span>
            )}
          </div>
        )}
      </div>

      {/* 차트 */}
      <div style={{ height: chartHeight }} className={large ? "px-2 pb-2" : "px-1 pb-1"}>
        <ResponsiveContainer width="100%" height="100%">
          {large ? (
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="timeLabel"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
                interval={Math.max(0, Math.floor(totalPoints / 6) - 1)}
              />
              <YAxis
                domain={[0, max ?? "auto"]}
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  fontSize: "11px",
                  padding: "8px 12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.7)",
                  color: "#fff",
                }}
                itemStyle={{ color: "#fff", padding: "2px 0" }}
                labelStyle={{ color: "#aaa", marginBottom: "4px" }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => {
                  const label = legend
                    ? name === "primary" ? legend[0] : legend[1]
                    : title;
                  return [
                    `${typeof v === "number" ? v.toFixed(2) : v}${unit ? ` ${unit}` : ""}`,
                    label,
                  ];
                }}
                labelFormatter={(_, payload) => {
                  if (payload?.[0]?.payload?.timeLabel) {
                    return payload[0].payload.timeLabel;
                  }
                  return "";
                }}
              />
              {legend && (
                <Legend
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(val: any) =>
                    val === "primary" ? legend[0] : legend[1]
                  }
                  wrapperStyle={{ fontSize: "10px", paddingTop: "2px" }}
                  iconType="plainline"
                  iconSize={12}
                />
              )}
              <Line
                type="monotone"
                dataKey="primary"
                stroke={color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              {secondHistory && secondColor && (
                <Line
                  type="monotone"
                  dataKey="secondary"
                  stroke={secondColor}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          ) : (
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="idx" hide />
              <YAxis domain={[0, max ?? "auto"]} hide />
              <Area
                type="monotone"
                dataKey="primary"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#grad-${title})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
