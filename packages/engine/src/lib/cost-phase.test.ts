import { describe, it, expect } from "vitest";
import { aggregateCostByPhase } from "./cost-phase";
import type { CostEntry } from "../parser/cost-parser";

describe("cost-phase", () => {
  describe("aggregateCostByPhase", () => {
    it("should aggregate costs by phase", () => {
      const entries: CostEntry[] = [
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-model",
          costUsd: 10.0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreate: 0,
          cacheRead: 0,
          phase: "task",
        },
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-model",
          costUsd: 5.0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreate: 0,
          cacheRead: 0,
          phase: "review",
        },
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-model",
          costUsd: 5.0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreate: 0,
          cacheRead: 0,
          phase: "other",
        },
      ];

      const result = aggregateCostByPhase(entries);
      expect(result.taskCost).toBe(10.0);
      expect(result.reviewCost).toBe(5.0);
      expect(result.otherCost).toBe(5.0);
    });

    it("should calculate percentages correctly", () => {
      const entries: CostEntry[] = [
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-model",
          costUsd: 50.0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreate: 0,
          cacheRead: 0,
          phase: "task",
        },
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-model",
          costUsd: 50.0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreate: 0,
          cacheRead: 0,
          phase: "review",
        },
      ];

      const result = aggregateCostByPhase(entries);
      expect(result.taskPct).toBe("50.0");
      expect(result.reviewPct).toBe("50.0");
      expect(result.otherPct).toBe("0.0");
    });

    it("should handle empty entries", () => {
      const result = aggregateCostByPhase([]);
      expect(result.taskCost).toBe(0);
      expect(result.reviewCost).toBe(0);
      expect(result.otherCost).toBe(0);
      expect(result.taskPct).toBe("0.0");
      expect(result.reviewPct).toBe("0.0");
      expect(result.otherPct).toBe("0.0");
    });

    it("should handle case-insensitive phase names", () => {
      const entries: CostEntry[] = [
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-model",
          costUsd: 10.0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreate: 0,
          cacheRead: 0,
          phase: "TASK",
        },
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-model",
          costUsd: 10.0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreate: 0,
          cacheRead: 0,
          phase: "Review",
        },
      ];

      const result = aggregateCostByPhase(entries);
      expect(result.taskCost).toBe(10.0);
      expect(result.reviewCost).toBe(10.0);
    });

    it("should handle missing phase as other", () => {
      const entries: CostEntry[] = [
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-model",
          costUsd: 5.0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreate: 0,
          cacheRead: 0,
          phase: undefined,
        },
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-model",
          costUsd: 5.0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreate: 0,
          cacheRead: 0,
          phase: "unknown",
        },
      ];

      const result = aggregateCostByPhase(entries);
      expect(result.otherCost).toBe(10.0);
      expect(result.taskCost).toBe(0);
      expect(result.reviewCost).toBe(0);
    });

    it("should format percentages to 1 decimal place", () => {
      const entries: CostEntry[] = [
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-model",
          costUsd: 33.33,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreate: 0,
          cacheRead: 0,
          phase: "task",
        },
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-model",
          costUsd: 66.67,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreate: 0,
          cacheRead: 0,
          phase: "review",
        },
      ];

      const result = aggregateCostByPhase(entries);
      expect(result.taskPct).toMatch(/\d+\.\d/);
      expect(result.reviewPct).toMatch(/\d+\.\d/);
    });
  });
});
