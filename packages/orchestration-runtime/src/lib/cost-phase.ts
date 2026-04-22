import type { CostEntry } from "../parser/cost-parser";

export interface PhaseCostSummary {
  taskCost: number;
  reviewCost: number;
  otherCost: number;
  taskPct: string;
  reviewPct: string;
  otherPct: string;
}

/**
 * Aggregate cost entries by phase ("task" / "review" / other).
 * Returns costs and percentage strings for each phase.
 */
export function aggregateCostByPhase(entries: CostEntry[]): PhaseCostSummary {
  let taskCost = 0;
  let reviewCost = 0;
  let otherCost = 0;

  for (const e of entries) {
    const phase = (e.phase ?? "").toLowerCase();
    if (phase === "task") {
      taskCost += e.costUsd;
    } else if (phase === "review") {
      reviewCost += e.costUsd;
    } else {
      otherCost += e.costUsd;
    }
  }

  const total = taskCost + reviewCost + otherCost;

  const pct = (v: number): string => {
    if (total === 0) return "0.0";
    return ((v / total) * 100).toFixed(1);
  };

  return {
    taskCost,
    reviewCost,
    otherCost,
    taskPct: pct(taskCost),
    reviewPct: pct(reviewCost),
    otherPct: pct(otherCost),
  };
}
