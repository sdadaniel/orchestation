"use client";

import type { RequestItem } from "@/hooks/useRequests";

interface RunningIndicatorProps {
  requestItems: RequestItem[];
}

export function RunningIndicator({ requestItems }: RunningIndicatorProps) {
  const runningTasks = requestItems.filter((t) => t.status === "in_progress");
  const count = runningTasks.length;

  if (count === 0) return null;

  return (
    <div className="running-indicator" title={runningTasks.map((t) => `${t.id}: ${t.title}`).join("\n")}>
      <span className="running-indicator-spinner" />
      <span className="running-indicator-text">
        Running<span className="running-indicator-dots" />
      </span>
      <span className="running-indicator-count">{count}</span>
    </div>
  );
}
