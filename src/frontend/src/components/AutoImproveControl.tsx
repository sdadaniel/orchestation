"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Play, Square, Loader2 } from "lucide-react";
import { HorseRunningIndicator } from "@/components/HorseRunningIndicator";

type RunStatus = "idle" | "running" | "stopping" | "completed" | "failed";

export default function AutoImproveControl() {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prevStatusRef = useRef<RunStatus>("idle");
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/orchestrate/status");
      if (res.ok) {
        const data = await res.json();
        // running → failed 전환 감지 시 에러 표시
        if (prevStatusRef.current === "running" && data.status === "failed") {
          setError(`실행 실패 (exit code: ${data.exitCode ?? "unknown"})`);
        }
        prevStatusRef.current = data.status;
        // stopping 중이면 실제 종료될 때까지 상태 유지
        // 같은 상태면 setState 호출 자체를 건너뛰어 불필요한 리렌더 방지
        setStatus((prev) => {
          if (prev === "stopping" && data.status === "running") return prev;
          if (prev === data.status) return prev;
          return data.status;
        });
      }
    } catch {
      // silently ignore polling errors
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orchestrate/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start");
      } else {
        setStatus("running");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setError(null);
    setStatus("stopping");
    try {
      const res = await fetch("/api/orchestrate/stop", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to stop");
        setStatus("running");
      }
      // polling이 실제 종료 감지하면 idle로 전환
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setStatus("running");
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
              loading && "opacity-50 cursor-not-allowed"
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
            loading && "opacity-50 cursor-not-allowed"
          )}
        >
          <Play className="h-3 w-3" />
          Run
        </button>
      )}

      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}
