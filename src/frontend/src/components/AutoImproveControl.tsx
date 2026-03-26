"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Play, Square, Loader2 } from "lucide-react";
import { HorseRunningIndicator } from "@/components/HorseRunningIndicator";
import { getErrorMessage } from "@/lib/error-utils";
import { useOrchestrationStore } from "@/store/orchestrationStore";

// API response type definitions
interface OrchestrationActionResponse {
  error?: string;
}

export default function AutoImproveControl({
  runningTaskCount = 0,
}: {
  runningTaskCount?: number;
} = {}) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Orchestration 상태를 store에서 직접 구독 (별도 polling 제거)
  const orchestrationStatus = useOrchestrationStore((s) => s.data.status);
  const exitCode = useOrchestrationStore((s) => s.data.exitCode);

  const isRunning =
    orchestrationStatus === "running" || runningTaskCount > 0;

  // isStarting 해제: running으로 바뀔 때만 해제
  const prevStatusRef = useRef(orchestrationStatus);
  useEffect(() => {
    if (isStarting && prevStatusRef.current !== "running" && orchestrationStatus === "running") {
      setIsStarting(false);
    }
    prevStatusRef.current = orchestrationStatus;
  }, [isStarting, orchestrationStatus]);

  // isStarting 타임아웃: 15초 안에 running 안 되면 자동 해제
  useEffect(() => {
    if (!isStarting) return;
    const timer = setTimeout(() => setIsStarting(false), 15000);
    return () => clearTimeout(timer);
  }, [isStarting]);

  // isStopping 해제: orchestration이 실제로 멈추면 stopping 상태 해제
  useEffect(() => {
    if (isStopping && orchestrationStatus !== "running") {
      setIsStopping(false);
    }
  }, [isStopping, orchestrationStatus]);

  const status = isStarting ? "starting" : isStopping ? "stopping" : orchestrationStatus;

  // failed 상태일 때 에러 메시지 표시 (Stop에 의한 종료(130)는 제외)
  const showError =
    orchestrationStatus === "failed" && exitCode != null && exitCode !== 130 && !isStopping;

  const handleRun = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/orchestrate/run", { method: "POST" });
      const data: OrchestrationActionResponse = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start");
        setIsStarting(false);
      }
      // store의 polling이 running 감지하면 isStarting 자동 해제
    } catch (err) {
      setError(getErrorMessage(err, "Network error"));
      setIsStarting(false);
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
      setError(getErrorMessage(err, "Network error"));
      setIsStopping(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {status === "starting" ? (
        <span className="filter-pill flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Starting...
        </span>
      ) : status === "stopping" ? (
        <span className="filter-pill flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Stopping...
        </span>
      ) : status === "running" ? (
        <>
          <div className="running-indicator">
            <span className="running-indicator-spinner" />
            <span className="running-indicator-text">
              Running<span className="running-indicator-dots" />
            </span>
            {runningTaskCount > 0 && (
              <span className="running-indicator-count">{runningTaskCount}</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleStop}
            disabled={isStopping}
            className={cn(
              "filter-pill flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300",
              isStopping && "opacity-50 cursor-not-allowed",
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
          disabled={isStarting}
          className={cn(
            "filter-pill active flex items-center gap-1.5 text-xs",
            isStarting && "opacity-50 cursor-not-allowed",
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
