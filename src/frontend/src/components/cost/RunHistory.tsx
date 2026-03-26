"use client";

import type { RunHistoryEntry } from "@/hooks/useRunHistory";
import { cn } from "@/lib/utils";

interface RunHistoryProps {
  runs: RunHistoryEntry[];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${remainSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return `${hours}h ${remainMin}m`;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function RunHistory({ runs }: RunHistoryProps) {
  if (runs.length === 0) return null;

  // Sort by most recent first
  const sorted = [...runs].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Execution History
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs compact-table">
          <thead>
            <tr className="border-b border-border text-left text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="font-medium">Time</th>
              <th className="font-medium">Result</th>
              <th className="font-medium text-right">Tasks</th>
              <th className="font-medium text-right">Duration</th>
              <th className="font-medium text-right">Cost</th>
              <th className="font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((run) => (
              <tr
                key={run.id}
                className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
              >
                <td className="font-mono text-muted-foreground">
                  {formatTimestamp(run.startedAt)}
                </td>
                <td>
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                      run.status === "completed"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                    )}
                  >
                    {run.status === "completed" ? "Success" : "Failed"}
                  </span>
                </td>
                <td className="text-right font-mono">
                  <span className="text-emerald-400">{run.tasksCompleted}</span>
                  {run.tasksFailed > 0 && (
                    <>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-400">{run.tasksFailed}</span>
                    </>
                  )}
                </td>
                <td className="text-right font-mono">
                  {formatDuration(run.totalDurationMs)}
                </td>
                <td className="text-right font-mono">
                  ${run.totalCostUsd.toFixed(4)}
                </td>
                <td className="text-muted-foreground">
                  {run.taskResults.length > 0 && (
                    <span className="text-[10px]">
                      {run.taskResults.map((r) => r.taskId).join(", ")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
