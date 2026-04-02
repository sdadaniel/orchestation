import { describe, it, expect } from "vitest";
import { shortenModelName, aggregateByModel } from "./cost-aggregation";
import type { CostEntry } from "./cost-parser";

describe("cost-aggregation", () => {
  describe("shortenModelName", () => {
    it("should shorten opus model names", () => {
      expect(shortenModelName("claude-opus-4-1-20250805")).toBe("Opus 4.1");
    });

    it("should shorten sonnet model names with proper version", () => {
      const result = shortenModelName("claude-sonnet-4-20250514");
      expect(result).toContain("Sonnet");
      expect(result).toContain("4");
    });

    it("should shorten haiku model names with proper version", () => {
      const result = shortenModelName("claude-3-5-haiku-20241022");
      expect(result).toContain("Haiku");
    });

    it("should handle alternative format with version first", () => {
      expect(shortenModelName("claude-3-5-sonnet")).toMatch(/sonnet|Sonnet/i);
    });

    it("should return Unknown for unknown model", () => {
      expect(shortenModelName("unknown")).toBe("Unknown");
    });

    it("should return Unknown for empty string", () => {
      expect(shortenModelName("")).toBe("Unknown");
    });

    it("should handle models without standard family names", () => {
      const result = shortenModelName("custom-model-20250101");
      expect(result).not.toBe("custom-model-20250101");
    });
  });

  describe("aggregateByModel", () => {
    it("should aggregate entries by model name", () => {
      const entries: CostEntry[] = [
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-opus-4",
          costUsd: 1.5,
          inputTokens: 100,
          outputTokens: 50,
          cacheCreate: 0,
          cacheRead: 0,
          phase: "task",
        },
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-opus-4",
          costUsd: 2.5,
          inputTokens: 200,
          outputTokens: 100,
          cacheCreate: 0,
          cacheRead: 0,
          phase: "task",
        },
      ];

      const result = aggregateByModel(entries);
      expect(result).toHaveLength(1);
      expect(result[0].model).toBe("claude-opus-4");
      expect(result[0].totalCostUsd).toBe(4.0);
      expect(result[0].totalInputTokens).toBe(300);
      expect(result[0].totalOutputTokens).toBe(150);
      expect(result[0].entries).toBe(2);
    });

    it("should sort by cost descending", () => {
      const entries: CostEntry[] = [
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-haiku",
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
          model: "claude-opus",
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
          model: "claude-sonnet",
          costUsd: 30.0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreate: 0,
          cacheRead: 0,
          phase: "task",
        },
      ];

      const result = aggregateByModel(entries);
      expect(result[0].model).toBe("claude-opus");
      expect(result[1].model).toBe("claude-sonnet");
      expect(result[2].model).toBe("claude-haiku");
    });

    it("should handle empty entries array", () => {
      const result = aggregateByModel([]);
      expect(result).toEqual([]);
    });

    it("should track cache operations", () => {
      const entries: CostEntry[] = [
        {
          timestamp: "2026-01-01 00:00:00",
          taskId: "TASK-001",
          turns: 1,
          durationMs: 1000,
          model: "claude-model",
          costUsd: 1.0,
          inputTokens: 100,
          outputTokens: 50,
          cacheCreate: 5000,
          cacheRead: 2000,
          phase: "task",
        },
      ];

      const result = aggregateByModel(entries);
      expect(result[0].totalCacheCreate).toBe(5000);
      expect(result[0].totalCacheRead).toBe(2000);
    });
  });
});
