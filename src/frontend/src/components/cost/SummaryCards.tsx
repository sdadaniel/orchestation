"use client";

import type { CostEntry, TaskCostSummary } from "@/parser/cost-parser";
import { aggregateByModel } from "@/lib/cost-aggregation";
import { aggregateCostByPhase } from "@/lib/cost-phase";

interface SummaryCardsProps {
  entries: CostEntry[];
  summaryByTask: TaskCostSummary[];
}

export function SummaryCards({ entries, summaryByTask }: SummaryCardsProps) {
  const totalCost = entries.reduce((sum, e) => sum + e.costUsd, 0);
  const totalTasks = summaryByTask.length;
  const avgCostPerTask = totalTasks > 0 ? totalCost / totalTasks : 0;
  const totalTokens = entries.reduce(
    (sum, e) => sum + e.inputTokens + e.outputTokens + e.cacheCreate + e.cacheRead,
    0,
  );

  const modelSummaries = aggregateByModel(entries);
  const phaseSummary = aggregateCostByPhase(entries);

  return (
    <div className="space-y-2">
      {/* Existing summary stats bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-label">Total Cost</span>
          <span className="stat-value">${totalCost.toFixed(4)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Tasks</span>
          <span className="stat-value">{totalTasks}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Avg/Task</span>
          <span className="stat-value">${avgCostPerTask.toFixed(4)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Tokens</span>
          <span className="stat-value">{totalTokens.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Phase Cost</span>
          <span className="stat-value text-[10px]">
            <span style={{ color: "#3b82f6" }}>Task ${phaseSummary.taskCost.toFixed(2)} ({phaseSummary.taskPct}%)</span>
            {" / "}
            <span style={{ color: "#a855f7" }}>Review ${phaseSummary.reviewCost.toFixed(2)} ({phaseSummary.reviewPct}%)</span>
            {phaseSummary.otherCost > 0 && (
              <>
                {" / "}
                <span style={{ color: "#6b7280" }}>기타 ${phaseSummary.otherCost.toFixed(2)} ({phaseSummary.otherPct}%)</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Model cost breakdown */}
      {modelSummaries.length > 0 && (
        <div className="stats-bar" style={{ gap: "16px" }}>
          <span
            className="stat-label"
            style={{ flexShrink: 0, alignSelf: "center" }}
          >
            By Model
          </span>
          {modelSummaries.map((m) => {
            const pct = totalCost > 0 ? (m.totalCostUsd / totalCost) * 100 : 0;
            return (
              <div key={m.model} className="stat-item" style={{ gap: "8px" }}>
                <span
                  className="stat-label"
                  style={{ whiteSpace: "nowrap" }}
                  title={m.model}
                >
                  {m.displayName}
                </span>
                <span className="stat-value">
                  ${m.totalCostUsd.toFixed(4)}
                </span>
                <span
                  className="stat-label"
                  style={{ fontSize: "10px" }}
                >
                  ({pct.toFixed(1)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
