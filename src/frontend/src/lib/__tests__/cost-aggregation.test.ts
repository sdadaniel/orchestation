import { describe, it, expect } from "vitest";
import { shortenModelName, aggregateByModel } from "../cost-aggregation";
import type { CostEntry } from "../../parser/cost-parser";

// ─── shortenModelName ───────────────────────────────────────────────────────

describe("shortenModelName", () => {
  it('returns "Unknown" for empty string', () => {
    expect(shortenModelName("")).toBe("Unknown");
  });

  it('returns "Unknown" for "unknown"', () => {
    expect(shortenModelName("unknown")).toBe("Unknown");
  });

  it('shortens "claude-sonnet-4-20250514" → "Sonnet 4"', () => {
    expect(shortenModelName("claude-sonnet-4-20250514")).toBe("Sonnet 4");
  });

  it('shortens "claude-opus-4-20250514" → "Opus 4"', () => {
    expect(shortenModelName("claude-opus-4-20250514")).toBe("Opus 4");
  });

  it('shortens "claude-haiku-3-20240307" → "Haiku 3"', () => {
    expect(shortenModelName("claude-haiku-3-20240307")).toBe("Haiku 3");
  });

  it('shortens opus with sub-version "claude-opus-4-1-20250805" → "Opus 4.1"', () => {
    expect(shortenModelName("claude-opus-4-1-20250805")).toBe("Opus 4.1");
  });

  it('shortens haiku with sub-version "claude-3-5-haiku-20241022" → "Haiku 3.5"', () => {
    expect(shortenModelName("claude-3-5-haiku-20241022")).toBe("Haiku 3.5");
  });

  it('shortens sonnet with sub-version "claude-3-5-sonnet-20241022" → "Sonnet 3.5"', () => {
    expect(shortenModelName("claude-3-5-sonnet-20241022")).toBe("Sonnet 3.5");
  });

  it("falls back gracefully for unrecognized model names", () => {
    const result = shortenModelName("some-other-model-99");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── aggregateByModel ───────────────────────────────────────────────────────

const makeEntry = (
  model: string,
  costUsd: number,
  inputTokens = 100,
  outputTokens = 50,
  cacheCreate = 0,
  cacheRead = 0
): CostEntry => ({
  timestamp: "2026-03-23 12:00:00",
  taskId: "TASK-001",
  phase: "task",
  model,
  inputTokens,
  cacheCreate,
  cacheRead,
  outputTokens,
  turns: 1,
  durationMs: 1000,
  costUsd,
});

describe("aggregateByModel", () => {
  it("returns empty array for no entries", () => {
    expect(aggregateByModel([])).toEqual([]);
  });

  it("aggregates single model correctly", () => {
    const entries = [makeEntry("claude-sonnet-4-20250514", 0.01, 500, 200, 50, 100)];
    const result = aggregateByModel(entries);
    expect(result).toHaveLength(1);
    expect(result[0].model).toBe("claude-sonnet-4-20250514");
    expect(result[0].totalCostUsd).toBeCloseTo(0.01);
    expect(result[0].totalInputTokens).toBe(500);
    expect(result[0].totalOutputTokens).toBe(200);
    expect(result[0].totalCacheCreate).toBe(50);
    expect(result[0].totalCacheRead).toBe(100);
    expect(result[0].entries).toBe(1);
  });

  it("aggregates multiple entries for same model", () => {
    const entries = [
      makeEntry("claude-sonnet-4-20250514", 0.01, 100, 50),
      makeEntry("claude-sonnet-4-20250514", 0.02, 200, 100),
    ];
    const result = aggregateByModel(entries);
    expect(result).toHaveLength(1);
    expect(result[0].totalCostUsd).toBeCloseTo(0.03);
    expect(result[0].totalInputTokens).toBe(300);
    expect(result[0].entries).toBe(2);
  });

  it("separates different models into separate summaries", () => {
    const entries = [
      makeEntry("claude-sonnet-4-20250514", 0.05),
      makeEntry("claude-opus-4-20250514", 0.10),
      makeEntry("claude-haiku-3-20240307", 0.01),
    ];
    const result = aggregateByModel(entries);
    expect(result).toHaveLength(3);
    const models = result.map((r) => r.model);
    expect(models).toContain("claude-sonnet-4-20250514");
    expect(models).toContain("claude-opus-4-20250514");
    expect(models).toContain("claude-haiku-3-20240307");
  });

  it("sorts results by totalCostUsd descending", () => {
    const entries = [
      makeEntry("model-cheap", 0.01),
      makeEntry("model-expensive", 0.10),
      makeEntry("model-mid", 0.05),
    ];
    const result = aggregateByModel(entries);
    expect(result[0].model).toBe("model-expensive");
    expect(result[1].model).toBe("model-mid");
    expect(result[2].model).toBe("model-cheap");
  });

  it("sets displayName via shortenModelName", () => {
    const entries = [makeEntry("claude-sonnet-4-20250514", 0.01)];
    const result = aggregateByModel(entries);
    expect(result[0].displayName).toBe("Sonnet 4");
  });

  it("handles 'unknown' model key", () => {
    const entries = [makeEntry("unknown", 0.005)];
    const result = aggregateByModel(entries);
    expect(result[0].model).toBe("unknown");
    expect(result[0].displayName).toBe("Unknown");
  });

  it("preserves floating-point precision", () => {
    const entries = [
      makeEntry("m", 0.1),
      makeEntry("m", 0.2),
    ];
    const result = aggregateByModel(entries);
    expect(result[0].totalCostUsd).toBeCloseTo(0.3, 6);
  });
});
