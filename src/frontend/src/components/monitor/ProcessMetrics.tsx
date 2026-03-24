"use client";

import type { MonitorSnapshot } from "@/hooks/useMonitor";
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

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "4px",
  fontSize: "11px",
  padding: "6px 10px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
};

const axisTickStyle = { fontSize: 9, fill: "hsl(var(--muted-foreground))" };

function formatTime(secondsAgo: number) {
  const m = Math.floor(secondsAgo / 60);
  const s = secondsAgo % 60;
  if (m > 0) return `-${m}m${s > 0 ? `${s}s` : ""}`;
  return `-${s}s`;
}

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
        {/* CPU per terminal */}
        <div className="rounded border border-border bg-card overflow-hidden">
          <div className="px-3 pt-2.5 pb-1">
            <div className="text-xs font-medium text-foreground">
              CPU per Terminal <span className="text-muted-foreground font-normal">(Percent)</span>
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
                  width={30}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ padding: "1px 0" }}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, _: any, props: any) => [
                    `${v}%`,
                    props?.payload?.label ?? "",
                  ]}
                />
                <Bar dataKey="cpu" radius={[3, 3, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory per terminal */}
        <div className="rounded border border-border bg-card overflow-hidden">
          <div className="px-3 pt-2.5 pb-1">
            <div className="text-xs font-medium text-foreground">
              Memory per Terminal <span className="text-muted-foreground font-normal">(MB)</span>
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
                  width={35}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ padding: "1px 0" }}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, _: any, props: any) => [
                    `${v} MB`,
                    props?.payload?.label ?? "",
                  ]}
                />
                <Bar dataKey="mem" radius={[3, 3, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 시계열 라인 차트 */}
      <div className="grid grid-cols-2 gap-3">
        {/* CPU History */}
        <div className="rounded border border-border bg-card overflow-hidden">
          <div className="px-3 pt-2.5 pb-1">
            <div className="text-xs font-medium text-foreground">
              CPU History <span className="text-muted-foreground font-normal">(Percent)</span>
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
                  width={30}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ padding: "1px 0" }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => {
                    const pid = String(name).replace("cpu_", "");
                    const idx = processes.findIndex((p) => String(p.pid) === pid);
                    return [`${typeof v === "number" ? v.toFixed(1) : v}%`, idx >= 0 ? `T${idx + 1} (PID ${pid})` : `PID ${pid}`];
                  }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.timeLabel ?? ""}
                />
                <Legend
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(val: any) => {
                    const pid = String(val).replace("cpu_", "");
                    const idx = processes.findIndex((p) => String(p.pid) === pid);
                    return idx >= 0 ? `T${idx + 1}` : val;
                  }}
                  wrapperStyle={{ fontSize: "10px", paddingTop: "2px" }}
                  iconType="plainline"
                  iconSize={12}
                />
                {processes.map((p, i) => (
                  <Line
                    key={p.pid}
                    type="monotone"
                    dataKey={`cpu_${p.pid}`}
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

        {/* Memory History */}
        <div className="rounded border border-border bg-card overflow-hidden">
          <div className="px-3 pt-2.5 pb-1">
            <div className="text-xs font-medium text-foreground">
              Memory History <span className="text-muted-foreground font-normal">(MB)</span>
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
                  width={35}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ padding: "1px 0" }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => {
                    const pid = String(name).replace("mem_", "");
                    const idx = processes.findIndex((p) => String(p.pid) === pid);
                    return [`${typeof v === "number" ? v.toFixed(0) : v} MB`, idx >= 0 ? `T${idx + 1} (PID ${pid})` : `PID ${pid}`];
                  }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.timeLabel ?? ""}
                />
                <Legend
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(val: any) => {
                    const pid = String(val).replace("mem_", "");
                    const idx = processes.findIndex((p) => String(p.pid) === pid);
                    return idx >= 0 ? `T${idx + 1}` : val;
                  }}
                  wrapperStyle={{ fontSize: "10px", paddingTop: "2px" }}
                  iconType="plainline"
                  iconSize={12}
                />
                {processes.map((p, i) => (
                  <Line
                    key={p.pid}
                    type="monotone"
                    dataKey={`mem_${p.pid}`}
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
