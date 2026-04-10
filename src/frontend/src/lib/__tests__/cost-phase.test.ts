import { describe, it, expect } from "vitest";
import { aggregateCostByPhase } from "../cost-phase";
import type { CostEntry } from "../cost-parser";

const makeEntry = (phase: string, costUsd: number): CostEntry => ({
  timestamp: "2026-03-23 12:00:00",
  taskId: "TASK-001",
  phase,
  model: "claude-sonnet-4-20250514",
  inputTokens: 100,
  cacheCreate: 0,
  cacheRead: 0,
  outputTokens: 50,
  turns: 1,
  durationMs: 1000,
  costUsd,
});

describe("aggregateCostByPhase", () => {
  it("returns all zeros with '0.0' percentages when entries is empty (total=0)", () => {
    const result = aggregateCostByPhase([]);
    expect(result.taskCost).toBe(0);
    expect(result.reviewCost).toBe(0);
    expect(result.otherCost).toBe(0);
    expect(result.taskPct).toBe("0.0");
    expect(result.reviewPct).toBe("0.0");
    expect(result.otherPct).toBe("0.0");
  });

  it("handles single task phase entry", () => {
    const result = aggregateCostByPhase([makeEntry("task", 1.0)]);
    expect(result.taskCost).toBeCloseTo(1.0);
    expect(result.reviewCost).toBe(0);
    expect(result.otherCost).toBe(0);
    expect(result.taskPct).toBe("100.0");
    expect(result.reviewPct).toBe("0.0");
    expect(result.otherPct).toBe("0.0");
  });

  it("handles single review phase entry", () => {
    const result = aggregateCostByPhase([makeEntry("review", 0.5)]);
    expect(result.reviewCost).toBeCloseTo(0.5);
    expect(result.taskCost).toBe(0);
    expect(result.reviewPct).toBe("100.0");
    expect(result.taskPct).toBe("0.0");
  });

  it("handles single 'other' phase entry", () => {
    const result = aggregateCostByPhase([makeEntry("setup", 0.25)]);
    expect(result.otherCost).toBeCloseTo(0.25);
    expect(result.otherPct).toBe("100.0");
  });

  it("splits task and review correctly, other=0", () => {
    const entries = [makeEntry("task", 0.8), makeEntry("review", 0.2)];
    const result = aggregateCostByPhase(entries);
    expect(result.taskCost).toBeCloseTo(0.8);
    expect(result.reviewCost).toBeCloseTo(0.2);
    expect(result.otherCost).toBe(0);
    expect(result.taskPct).toBe("80.0");
    expect(result.reviewPct).toBe("20.0");
    expect(result.otherPct).toBe("0.0");
  });

  it("three-way split adds up to 100%", () => {
    const entries = [
      makeEntry("task", 0.5),
      makeEntry("review", 0.3),
      makeEntry("other-phase", 0.2),
    ];
    const result = aggregateCostByPhase(entries);
    expect(result.taskPct).toBe("50.0");
    expect(result.reviewPct).toBe("30.0");
    expect(result.otherPct).toBe("20.0");

    const total =
      parseFloat(result.taskPct) +
      parseFloat(result.reviewPct) +
      parseFloat(result.otherPct);
    expect(total).toBeCloseTo(100, 1);
  });

  it("is case-insensitive for phase names (uppercase TASK)", () => {
    const entry: CostEntry = { ...makeEntry("TASK", 1.0) };
    const result = aggregateCostByPhase([entry]);
    expect(result.taskCost).toBeCloseTo(1.0);
    expect(result.taskPct).toBe("100.0");
  });

  it("is case-insensitive for phase names (uppercase REVIEW)", () => {
    const entry: CostEntry = { ...makeEntry("REVIEW", 1.0) };
    const result = aggregateCostByPhase([entry]);
    expect(result.reviewCost).toBeCloseTo(1.0);
    expect(result.reviewPct).toBe("100.0");
  });

  it("accumulates multiple entries per phase", () => {
    const entries = [
      makeEntry("task", 0.1),
      makeEntry("task", 0.2),
      makeEntry("task", 0.3),
      makeEntry("review", 0.1),
      makeEntry("review", 0.1),
    ];
    const result = aggregateCostByPhase(entries);
    expect(result.taskCost).toBeCloseTo(0.6);
    expect(result.reviewCost).toBeCloseTo(0.2);
    expect(result.taskPct).toBe("75.0");
    expect(result.reviewPct).toBe("25.0");
  });

  it("pct strings have exactly 1 decimal place", () => {
    const entries = [
      makeEntry("task", 1),
      makeEntry("review", 2),
      makeEntry("other", 3),
    ];
    const result = aggregateCostByPhase(entries);
    for (const pct of [result.taskPct, result.reviewPct, result.otherPct]) {
      expect(pct).toMatch(/^\d+\.\d$/);
    }
  });
});
