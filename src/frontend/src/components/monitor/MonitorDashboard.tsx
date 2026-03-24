"use client";

import { useMonitor } from "@/hooks/useMonitor";
import { MetricCard } from "./MetricCard";
import { ProcessMetrics } from "./ProcessMetrics";
import { AlertCircle } from "lucide-react";

export function MonitorDashboard() {
  const { current, history, error } = useMonitor(1000);

  if (error && !current) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-muted-foreground animate-pulse">Loading metrics...</span>
      </div>
    );
  }

  const cpuUsed = +(current.cpu.user + current.cpu.system).toFixed(1);
  const memUsedGB = (current.memory.used / 1024 / 1024 / 1024).toFixed(1);
  const memTotalGB = (current.memory.total / 1024 / 1024 / 1024).toFixed(1);

  return (
    <div className="space-y-3">
      {/* 상단 제목 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">System Monitor</h2>
        <span className="text-[10px] text-muted-foreground font-mono">
          {current.cpuCores} cores · {memTotalGB} GB RAM · {current.processCount} processes
        </span>
      </div>

      {/* 메트릭 카드 그리드 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard
          title="CPU Utilization"
          unit="Percent"
          value={`${cpuUsed}%`}
          subtitle={`sys ${current.cpu.system.toFixed(1)}% · usr ${current.cpu.user.toFixed(1)}%`}
          color="#ff9900"
          history={history.map((s) => s.cpu.user + s.cpu.system)}
          max={100}
        />
        <MetricCard
          title="Memory Usage"
          unit="Percent"
          value={`${current.memory.usedPercent}%`}
          subtitle={`${memUsedGB} / ${memTotalGB} GB`}
          color="#1f77b4"
          history={history.map((s) => s.memory.usedPercent)}
          max={100}
        />
        <MetricCard
          title="Load Average"
          unit="1min"
          value={`${current.loadAvg["1m"]}`}
          subtitle={`5m: ${current.loadAvg["5m"]} · 15m: ${current.loadAvg["15m"]}`}
          color="#2ca02c"
          history={history.map((s) => s.loadAvg["1m"])}
        />
        <MetricCard
          title="Threads"
          unit="Count"
          value={current.threadCount.toLocaleString()}
          subtitle={`${current.processCount} processes`}
          color="#9467bd"
          history={history.map((s) => s.threadCount)}
        />
      </div>

      {/* 하단 상세 차트 */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="CPU Utilization"
          unit="Percent"
          value={`${cpuUsed}%`}
          color="#ff9900"
          secondColor="#1f77b4"
          history={history.map((s) => s.cpu.system)}
          secondHistory={history.map((s) => s.cpu.user)}
          legend={["System", "User"]}
          max={100}
          large
        />
        <MetricCard
          title="Memory Utilization"
          unit="Percent"
          value={`${current.memory.usedPercent}%`}
          color="#1f77b4"
          history={history.map((s) => s.memory.usedPercent)}
          max={100}
          large
        />
      </div>

      {/* Claude 터미널별 리소스 */}
      <ProcessMetrics current={current} history={history} />
    </div>
  );
}
