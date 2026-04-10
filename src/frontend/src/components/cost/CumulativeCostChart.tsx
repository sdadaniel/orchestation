"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { TooltipValueType } from "recharts";
import type { CostEntry } from "@/lib/cost-parser";

interface CumulativeCostChartProps {
  entries: CostEntry[];
}

interface ChartDataPoint {
  timestamp: string;
  label: string;
  cost: number;
  cumulative: number;
}

function buildChartData(entries: CostEntry[]): ChartDataPoint[] {
  if (entries.length === 0) return [];

  // Sort entries by timestamp ascending
  const sorted = [...entries].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );

  let cumulative = 0;
  return sorted.map((entry) => {
    cumulative += entry.costUsd;
    // Show HH:MM for label to keep X-axis compact
    const timePart = entry.timestamp.split(" ")[1] ?? entry.timestamp;
    const label = timePart.slice(0, 5); // "HH:MM"

    return {
      timestamp: entry.timestamp,
      label,
      cost: entry.costUsd,
      cumulative: parseFloat(cumulative.toFixed(4)),
    };
  });
}

export function CumulativeCostChart({ entries }: CumulativeCostChartProps) {
  const data = useMemo(() => buildChartData(entries), [entries]);

  if (data.length === 0) return null;

  const maxCumulative = data[data.length - 1]?.cumulative ?? 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">
          누적 비용 추이
        </span>
        <span className="text-[10px] text-muted-foreground">
          Total: ${maxCumulative.toFixed(4)}
        </span>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 12, bottom: 4, left: 12 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.4}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={(value: number) => `$${value.toFixed(2)}`}
              width={52}
              domain={[0, "auto"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "11px",
              }}
              formatter={(
                value: TooltipValueType | undefined,
                name: string | number | undefined,
              ) => [
                `$${Number(value ?? 0).toFixed(4)}`,
                name === "cumulative" ? "누적 비용" : "개별 비용",
              ]}
              labelFormatter={(_, payload) => {
                if (payload && payload.length > 0) {
                  const point = payload[0]?.payload as
                    | ChartDataPoint
                    | undefined;
                  return point?.timestamp ?? "";
                }
                return "";
              }}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#22c55e"
              strokeWidth={2}
              fill="#22c55e"
              fillOpacity={0.1}
              dot={data.length <= 30}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
