"use client";

import { useMonitor } from "@/hooks/useMonitor";
import { CpuMetrics } from "./CpuMetrics";
import { CpuChart } from "./CpuChart";
import { SystemInfo } from "./SystemInfo";
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
        <span className="text-sm text-muted-foreground animate-pulse">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex gap-0 border border-border rounded-lg overflow-hidden bg-card">
      {/* 왼쪽: CPU 사용률 */}
      <div className="flex-shrink-0 w-52 p-4 border-r border-border">
        <CpuMetrics cpu={current.cpu} />
      </div>

      {/* 중앙: CPU 로드 차트 */}
      <div className="flex-1 p-4 border-r border-border min-w-0">
        <CpuChart history={history} />
      </div>

      {/* 오른쪽: 시스템 정보 */}
      <div className="flex-shrink-0 w-48 p-4">
        <SystemInfo
          threadCount={current.threadCount}
          processCount={current.processCount}
          loadAvg={current.loadAvg}
          cpuCores={current.cpuCores}
        />
      </div>
    </div>
  );
}
