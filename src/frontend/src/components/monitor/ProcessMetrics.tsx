"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { MonitorSnapshot } from "@/hooks/useMonitor";
import type {
  TooltipValueType,
  TooltipPayloadEntry,
  LegendPayload,
} from "recharts";
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

const WORKER_COLORS = [
  "#ff9900",
  "#1f77b4",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#17becf",
  "#bcbd22",
  "#ff7f0e",
];

const USER_COLORS = ["#6b7280", "#9ca3af", "#d1d5db", "#4b5563", "#374151"];

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

export function ProcessMetrics({ current, history }: ProcessMetricsProps) {
  const [showAll, setShowAll] = useState(false);

  const allProcesses = current.claudeProcesses || [];
  const workerProcesses = allProcesses.filter((p) => p.isWorker);
  const userProcesses = allProcesses.filter((p) => !p.isWorker);

  const processes = showAll ? allProcesses : workerProcesses;

  const totalCpu = processes.reduce((s, p) => s + p.cpu, 0);
  const totalMem = processes.reduce((s, p) => s + p.memMB, 0);

  const getColor = (isWorker: boolean | undefined, idx: number) => {
    if (isWorker) return WORKER_COLORS[idx % WORKER_COLORS.length];
    return USER_COLORS[idx % USER_COLORS.length];
  };

  if (allProcesses.length === 0) {
    return (
      <div className="rounded border border-border bg-card p-4">
        <div className="text-xs font-medium text-foreground mb-2">
          Claude Processes
        </div>
        <p className="text-sm text-muted-foreground">
          No active Claude processes detected
        </p>
      </div>
    );
  }

  if (!showAll && workerProcesses.length === 0) {
    return (
      <div className="rounded border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-foreground">
            Orchestrate Workers
          </div>
          <button
            onClick={() => setShowAll(true)}
            className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors"
          >
            전체 보기 ({allProcesses.length}개)
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          No active worker processes detected
        </p>
        {userProcesses.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            유저 Claude {userProcesses.length}개 실행 중 (전체 보기로 확인)
          </p>
        )}
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
    const snapProcesses = showAll
      ? snap.claudeProcesses || []
      : (snap.claudeProcesses || []).filter((p) => p.isWorker);
    snapProcesses.forEach((p) => {
      entry[`cpu_${p.pid}`] = p.cpu;
      entry[`mem_${p.pid}`] = p.memMB;
    });
    return entry;
  });

  // 바차트 데이터
  let workerCount = 0;
  let userCount = 0;
  const barData = processes.map((p) => {
    const isWorker = p.isWorker;
    const idx = isWorker ? workerCount++ : userCount++;
    return {
      name: isWorker ? `W${idx + 1}` : `U${idx + 1}`,
      label: p.label,
      cpu: +p.cpu.toFixed(1),
      mem: +p.memMB.toFixed(0),
      color: getColor(isWorker, idx),
      isWorker,
    };
  });

  const xAxisInterval = Math.max(0, Math.floor(totalPoints / 6) - 1);

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {showAll ? "Claude Processes" : "Orchestrate Workers"}{" "}
            <span className="font-normal text-muted-foreground">
              ({processes.length} active)
            </span>
          </h2>
          {showAll && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
                ⚙ {workerProcesses.length} worker
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400 font-medium">
                👤 {userProcesses.length} user
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground font-mono">
            Total: CPU {totalCpu.toFixed(1)}% · MEM {totalMem.toFixed(0)} MB
          </span>
          <button
            onClick={() => setShowAll((v) => !v)}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              showAll
                ? "border-amber-500/50 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {showAll ? "워커만 보기" : `전체 보기 (${allProcesses.length}개)`}
          </button>
        </div>
      </div>

      {/* 바 차트 */}
      <div className="grid grid-cols-2 gap-3">
        {/* CPU per process */}
        <div className="rounded border border-border bg-card overflow-hidden">
          <div className="px-3 pt-2.5 pb-1">
            <div className="text-xs font-medium text-foreground">
              CPU per Process{" "}
              <span className="text-muted-foreground font-normal">
                (Percent)
              </span>
            </div>
          </div>
          <div style={{ height: 180 }} className="px-2 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.5}
                  vertical={false}
                />
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
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  formatter={(
                    value: TooltipValueType | undefined,
                    _: number | string | undefined,
                    item: TooltipPayloadEntry,
                  ): [string, string] => [
                    `${value}%`,
                    String(item?.payload?.label ?? ""),
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

        {/* Memory per process */}
        <div className="rounded border border-border bg-card overflow-hidden">
          <div className="px-3 pt-2.5 pb-1">
            <div className="text-xs font-medium text-foreground">
              Memory per Process{" "}
              <span className="text-muted-foreground font-normal">(MB)</span>
            </div>
          </div>
          <div style={{ height: 180 }} className="px-2 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.5}
                  vertical={false}
                />
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
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  formatter={(
                    value: TooltipValueType | undefined,
                    _: number | string | undefined,
                    item: TooltipPayloadEntry,
                  ): [string, string] => [
                    `${value} MB`,
                    String(item?.payload?.label ?? ""),
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
              CPU History{" "}
              <span className="text-muted-foreground font-normal">
                (Percent)
              </span>
            </div>
          </div>
          <div style={{ height: 180 }} className="px-2 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={timeSeriesData}
                margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.5}
                />
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
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(
                    value: TooltipValueType | undefined,
                    name: number | string | undefined,
                  ): [string, string] => {
                    const pid = String(name).replace("cpu_", "");
                    const proc = processes.find((p) => String(p.pid) === pid);
                    const shortLabel = proc?.isWorker
                      ? (proc.taskId ?? `W (PID ${pid})`)
                      : `User (PID ${pid})`;
                    return [
                      `${typeof value === "number" ? value.toFixed(1) : value}%`,
                      shortLabel,
                    ];
                  }}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.timeLabel ?? ""
                  }
                />
                <Legend
                  formatter={(
                    value: string | undefined,
                    _entry: LegendPayload,
                    _index: number,
                  ): ReactNode => {
                    const pid = String(value).replace("cpu_", "");
                    const proc = processes.find((p) => String(p.pid) === pid);
                    if (!proc) return value;
                    return proc.isWorker
                      ? (proc.taskId ?? `W${pid}`)
                      : `U${pid}`;
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
                    stroke={getColor(p.isWorker, i)}
                    strokeWidth={p.isWorker ? 1.5 : 1}
                    strokeDasharray={p.isWorker ? undefined : "4 2"}
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
              Memory History{" "}
              <span className="text-muted-foreground font-normal">(MB)</span>
            </div>
          </div>
          <div style={{ height: 180 }} className="px-2 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={timeSeriesData}
                margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.5}
                />
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
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(
                    value: TooltipValueType | undefined,
                    name: number | string | undefined,
                  ): [string, string] => {
                    const pid = String(name).replace("mem_", "");
                    const proc = processes.find((p) => String(p.pid) === pid);
                    const shortLabel = proc?.isWorker
                      ? (proc.taskId ?? `W (PID ${pid})`)
                      : `User (PID ${pid})`;
                    return [
                      `${typeof value === "number" ? value.toFixed(0) : value} MB`,
                      shortLabel,
                    ];
                  }}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.timeLabel ?? ""
                  }
                />
                <Legend
                  formatter={(
                    value: string | undefined,
                    _entry: LegendPayload,
                    _index: number,
                  ): ReactNode => {
                    const pid = String(value).replace("mem_", "");
                    const proc = processes.find((p) => String(p.pid) === pid);
                    if (!proc) return value;
                    return proc.isWorker
                      ? (proc.taskId ?? `W${pid}`)
                      : `U${pid}`;
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
                    stroke={getColor(p.isWorker, i)}
                    strokeWidth={p.isWorker ? 1.5 : 1}
                    strokeDasharray={p.isWorker ? undefined : "4 2"}
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
              <th className="text-left px-3 py-2 font-medium">Process</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-right px-3 py-2 font-medium">PID</th>
              <th className="text-right px-3 py-2 font-medium">CPU %</th>
              <th className="text-right px-3 py-2 font-medium">MEM (MB)</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let wIdx = 0;
              let uIdx = 0;
              return processes.map((p) => {
                const isWorker = p.isWorker;
                const colorIdx = isWorker ? wIdx : uIdx;
                const shortName = isWorker
                  ? `W${++wIdx}${p.taskId ? ` · ${p.taskId}` : ""}`
                  : `U${++uIdx}`;
                const color = getColor(isWorker, colorIdx);
                return (
                  <tr
                    key={p.pid}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="px-3 py-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    </td>
                    <td className="px-3 py-1.5 font-mono">{shortName}</td>
                    <td className="px-3 py-1.5">
                      {isWorker ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-medium">
                          ⚙ Worker
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-700/50 text-zinc-400 font-medium">
                          👤 User
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                      {p.pid}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      <span
                        style={{
                          color:
                            p.cpu > 50
                              ? "#d62728"
                              : p.cpu > 20
                                ? "#ff9900"
                                : "#2ca02c",
                        }}
                      >
                        {p.cpu.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {p.memMB.toFixed(0)}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-muted-foreground">Running</span>
                      </span>
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
