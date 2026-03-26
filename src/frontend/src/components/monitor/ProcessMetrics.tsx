"use client";

import type { ReactNode } from "react";
import type { MonitorSnapshot } from "@/hooks/useMonitor";
import type { TooltipValueType, TooltipPayloadEntry, LegendPayload } from "recharts";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface ProcessMetricsProps {
  current: MonitorSnapshot;
  history: MonitorSnapshot[];
}

const COLORS = [
  "#ff9900", "#1f77b4", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#17becf", "#bcbd22", "#ff7f0e",
];

const tooltipContentStyle = {
  backgroundColor: "#111",
  border: "1px solid #333",
  borderRadius: "4px",
  fontSize: "11px",
  padding: "8px 12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.7)",
  color: "#fff",
};
const tooltipItemStyle = { color: "#fff", padding: "2px 0" };
const tooltipLabelStyle = { color: "#aaa", marginBottom: "4px" };

const axisTickStyle = { fontSize: 9, fill: "hsl(var(--muted-foreground))" };

function formatTime(secondsAgo: number) {
  const m = Math.floor(secondsAgo / 60);
  const s = secondsAgo % 60;
  if (m > 0) return `-${m}m${s > 0 ? `${s}s` : ""}`;
  return `-${s}s`;
}

interface BarChartConfig {
  title: string;
  unit: string;
  dataKey: "cpu" | "mem";
  yAxisWidth: number;
  formatValue: (v: TooltipValueType | undefined) => string;
}

interface LineChartConfig {
  title: string;
  unit: string;
  prefix: "cpu_" | "mem_";
  yAxisWidth: number;
  formatValue: (v: number) => string;
}

const barChartConfigs: BarChartConfig[] = [
  {
    title: "CPU per Terminal",
    unit: "Percent",
    dataKey: "cpu",
    yAxisWidth: 30,
    formatValue: (v) => `${v}%`,
  },
  {
    title: "Memory per Terminal",
    unit: "MB",
    dataKey: "mem",
    yAxisWidth: 35,
    formatValue: (v) => `${v} MB`,
  },
];

const lineChartConfigs: LineChartConfig[] = [
  {
    title: "CPU History",
    unit: "Percent",
    prefix: "cpu_",
    yAxisWidth: 30,
    formatValue: (v) => `${v.toFixed(1)}%`,
  },
  {
    title: "Memory History",
    unit: "MB",
    prefix: "mem_",
    yAxisWidth: 35,
    formatValue: (v) => `${v.toFixed(0)} MB`,
  },
];

export function ProcessMetrics({ current, history }: ProcessMetricsProps) {
  const processes = current.claudeProcesses || [];
  const totalCpu = processes.reduce((s, p) => s + p.cpu, 0);
  const totalMem = processes.reduce((s, p) => s + p.memMB, 0);

  if (processes.length === 0) {
    return (
      <div className="rounded border border-border bg-card p-4">
        <div className="text-xs font-medium text-foreground mb-2">
          Claude Terminals
        </div>
        <p className="text-sm text-muted-foreground">
          No active Claude terminals detected
        </p>
      </div>
    );
  }

  const totalPoints = history.length;

  // 시계열 데이터
  const timeSeriesData = history.map((snap, i) => {
    const entry: Record<string, number | string> = {
      idx: i,
      timeLabel: formatTime(totalPoints - 1 - i),
    };
    (snap.claudeProcesses || []).forEach((p) => {
      entry[`cpu_${p.pid}`] = p.cpu;
      entry[`mem_${p.pid}`] = p.memMB;
    });
    return entry;
  });

  // 바차트 데이터
  const barData = processes.map((p, i) => ({
    name: `T${i + 1}`,
    label: p.label,
    cpu: +p.cpu.toFixed(1),
    mem: +p.memMB.toFixed(0),
    color: COLORS[i % COLORS.length],
  }));

  const xAxisInterval = Math.max(0, Math.floor(totalPoints / 6) - 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Claude Terminals ({processes.length} active)
        </h2>
        <span className="text-[10px] text-muted-foreground font-mono">
          Total: CPU {totalCpu.toFixed(1)}% · MEM {totalMem.toFixed(0)} MB
        </span>
      </div>

      {/* 바 차트 */}
      <div className="grid grid-cols-2 gap-3">
        {barChartConfigs.map((cfg) => (
          <div key={cfg.dataKey} className="rounded border border-border bg-card overflow-hidden">
            <div className="px-3 pt-2.5 pb-1">
              <div className="text-xs font-medium text-foreground">
                {cfg.title} <span className="text-muted-foreground font-normal">({cfg.unit})</span>
              </div>
            </div>
            <div style={{ height: 180 }} className="px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={axisTickStyle}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={axisTickStyle}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={false}
                    width={cfg.yAxisWidth}
                  />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    formatter={(value: TooltipValueType | undefined, _: number | string | undefined, item: TooltipPayloadEntry): [string, string] => [
                      cfg.formatValue(value),
                      String(item?.payload?.label ?? ""),
                    ]}
                  />
                  <Bar dataKey={cfg.dataKey} radius={[3, 3, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* 시계열 라인 차트 */}
      <div className="grid grid-cols-2 gap-3">
        {lineChartConfigs.map((cfg) => (
          <div key={cfg.prefix} className="rounded border border-border bg-card overflow-hidden">
            <div className="px-3 pt-2.5 pb-1">
              <div className="text-xs font-medium text-foreground">
                {cfg.title} <span className="text-muted-foreground font-normal">({cfg.unit})</span>
              </div>
            </div>
            <div style={{ height: 180 }} className="px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="timeLabel"
                    tick={axisTickStyle}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={false}
                    interval={xAxisInterval}
                  />
                  <YAxis
                    domain={[0, "auto"]}
                    tick={axisTickStyle}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={false}
                    width={cfg.yAxisWidth}
                  />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(value: TooltipValueType | undefined, name: number | string | undefined): [string, string] => {
                      const pid = String(name).replace(cfg.prefix, "");
                      const idx = processes.findIndex((p) => String(p.pid) === pid);
                      return [
                        typeof value === "number" ? cfg.formatValue(value) : String(value),
                        idx >= 0 ? `T${idx + 1} (PID ${pid})` : `PID ${pid}`,
                      ];
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.timeLabel ?? ""}
                  />
                  <Legend
                    formatter={(value: string | undefined, _entry: LegendPayload, _index: number): ReactNode => {
                      const pid = String(value).replace(cfg.prefix, "");
                      const idx = processes.findIndex((p) => String(p.pid) === pid);
                      return idx >= 0 ? `T${idx + 1}` : value;
                    }}
                    wrapperStyle={{ fontSize: "10px", paddingTop: "2px" }}
                    iconType="plainline"
                    iconSize={12}
                  />
                  {processes.map((p, i) => (
                    <Line
                      key={p.pid}
                      type="monotone"
                      dataKey={`${cfg.prefix}${p.pid}`}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* 프로세스 테이블 */}
      <div className="rounded border border-border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">#</th>
              <th className="text-left px-3 py-2 font-medium">Terminal</th>
              <th className="text-right px-3 py-2 font-medium">PID</th>
              <th className="text-right px-3 py-2 font-medium">CPU %</th>
              <th className="text-right px-3 py-2 font-medium">MEM (MB)</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {processes.map((p, i) => (
              <tr key={p.pid} className="border-b border-border/50 last:border-0">
                <td className="px-3 py-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                </td>
                <td className="px-3 py-1.5 font-mono">T{i + 1}</td>
                <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{p.pid}</td>
                <td className="px-3 py-1.5 text-right font-mono">
                  <span style={{ color: p.cpu > 50 ? "#d62728" : p.cpu > 20 ? "#ff9900" : "#2ca02c" }}>
                    {p.cpu.toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right font-mono">{p.memMB.toFixed(0)}</td>
                <td className="px-3 py-1.5">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-muted-foreground">Running</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
