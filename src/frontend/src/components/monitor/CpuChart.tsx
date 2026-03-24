"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { MonitorSnapshot } from "@/hooks/useMonitor";

interface CpuChartProps {
  history: MonitorSnapshot[];
}

export function CpuChart({ history }: CpuChartProps) {
  const data = history.map((s, i) => ({
    idx: i,
    system: s.cpu.system,
    user: s.cpu.user,
    load: s.loadAvg["1m"],
  }));

  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground text-center">CPU 로드</div>
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 4, bottom: 2, left: 4 }}>
            <XAxis dataKey="idx" hide />
            <YAxis domain={[0, "auto"]} hide />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "11px",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                `${(value ?? 0).toFixed(2)}${name === "load" ? "" : "%"}`,
                name === "system" ? "시스템" : name === "user" ? "사용자" : "로드",
              ]}
              labelFormatter={() => ""}
            />
            <Line
              type="monotone"
              dataKey="system"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="user"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
