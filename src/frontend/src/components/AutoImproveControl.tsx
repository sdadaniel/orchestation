"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Play, Square, Loader2 } from "lucide-react";

type RunStatus = "idle" | "running" | "completed" | "failed";

export default function AutoImproveControl() {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/orchestrate/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
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
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orchestrate/stop", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to stop");
      } else {
        setStatus("idle");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {status === "idle" || status === "completed" || status === "failed" ? (
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
      ) : status === "running" ? (
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
      ) : null}

      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}
