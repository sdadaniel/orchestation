"use client";

import type { CostEntry } from "@/lib/cost-parser";

interface CostTableProps {
  entries: CostEntry[];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = Math.round(seconds % 60);
  return `${minutes}m ${remainSec}s`;
}

export function CostTable({ entries }: CostTableProps) {
  const sorted = [...entries].sort((a, b) => b.costUsd - a.costUsd);
  const maxCost = sorted.length > 0 ? sorted[0].costUsd : 0;

  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Task ID</th>
              <th className="px-4 py-3 font-medium">Phase</th>
              <th className="px-4 py-3 font-medium text-right">비용</th>
              <th className="px-4 py-3 font-medium text-right">시간</th>
              <th className="px-4 py-3 font-medium text-right">턴 수</th>
              <th className="px-4 py-3 font-medium text-right">토큰 수</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, idx) => {
              const isHighest = entry.costUsd === maxCost && maxCost > 0;
              const totalTokens =
                entry.inputTokens +
                entry.outputTokens +
                entry.cacheCreate +
                entry.cacheRead;

              return (
                <tr
                  key={`${entry.taskId}-${entry.phase}-${entry.timestamp}-${idx}`}
                  className={`border-b last:border-b-0 transition-colors ${
                    isHighest
                      ? "bg-amber-500/10 font-semibold"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className={isHighest ? "text-amber-500" : ""}>
                      {entry.taskId}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.phase === "task"
                          ? "bg-blue-500/15 text-blue-500"
                          : "bg-purple-500/15 text-purple-500"
                      }`}
                    >
                      {entry.phase}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    ${entry.costUsd.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatDuration(entry.durationMs)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {entry.turns}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {totalTokens.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
