"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Play, Square, Loader2 } from "lucide-react";
import { HorseRunningIndicator } from "@/components/HorseRunningIndicator";
import { useOrchestrationStore } from "@/store/orchestrationStore";

// API response type definitions
interface OrchestrationActionResponse {
  error?: string;
}

export default function AutoImproveControl({
  hasRunningTasks = false,
}: {
  hasRunningTasks?: boolean;
} = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState(false);

  // Orchestration 상태를 store에서 직접 구독 (별도 polling 제거)
  const orchestrationStatus = useOrchestrationStore((s) => s.data.status);
  const exitCode = useOrchestrationStore((s) => s.data.exitCode);

  const isRunning =
    orchestrationStatus === "running" || hasRunningTasks;

  // isStopping 해제: orchestration이 실제로 멈추면 stopping 상태 해제
  useEffect(() => {
    if (isStopping && orchestrationStatus !== "running") {
      setIsStopping(false);
    }
  }, [isStopping, orchestrationStatus]);

  const status = isStopping ? "stopping" : orchestrationStatus;

  // failed 상태일 때 에러 메시지 표시
  const showError =
    orchestrationStatus === "failed" && exitCode != null && !isStopping;

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orchestrate/run", { method: "POST" });
      const data: OrchestrationActionResponse = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start");
      }
      // store의 polling이 상태를 자동으로 업데이트함
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setError(null);
    setIsStopping(true);
    try {
      const res = await fetch("/api/orchestrate/stop", { method: "POST" });
      const data: OrchestrationActionResponse = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to stop");
        setIsStopping(false);
      }
      // store의 polling이 실제 종료 감지하면 상태가 idle로 전환됨
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setIsStopping(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {status === "stopping" ? (
        <span className="filter-pill flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Stopping...
        </span>
      ) : status === "running" ? (
        <>
          <HorseRunningIndicator />
          <button
            type="button"
            onClick={handleStop}
            disabled={loading}
            className={cn(
              "filter-pill flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300",
              loading && "opacity-50 cursor-not-allowed",
            )}
          >
            <Square className="h-3 w-3" />
            Stop
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleRun}
          disabled={loading}
          className={cn(
            "filter-pill active flex items-center gap-1.5 text-xs",
            loading && "opacity-50 cursor-not-allowed",
          )}
        >
          <Play className="h-3 w-3" />
          Run
        </button>
      )}

      {showError && (
        <span className="text-xs text-red-500">
          실행 실패 (exit code: {exitCode ?? "unknown"})
        </span>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
