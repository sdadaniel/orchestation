import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("fs", () => {
  const mod = {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue(""),
    readdirSync: vi.fn().mockReturnValue([]),
  };
  return { default: mod, ...mod };
});

import * as fs from "fs";
import { parseCostLog } from "./cost-parser";

const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
  mockReadFileSync.mockReturnValue("");
});

// ──────────────────────────────────────────────────────────────
// parseCostLog — file absent
// ──────────────────────────────────────────────────────────────
describe("parseCostLog — no log file", () => {
  it("returns empty entries and summaries when log file does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    const result = parseCostLog();
    expect(result.entries).toEqual([]);
    expect(result.summaryByTask).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
// parseCostLog — new format (with model)
// ──────────────────────────────────────────────────────────────
describe("parseCostLog — new format with model", () => {
  const newFormatLine =
    "[2026-03-27 10:00:00] TASK-001 | phase=task | model=claude-sonnet-4-20250514 | input=1500 cache_create=100 cache_read=0 output=2400 | turns=3 | duration=5230ms | cost=$0.045";

  beforeEach(() => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(newFormatLine + "\n");
  });

  it("parses a single line correctly", () => {
    const { entries } = parseCostLog();
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.timestamp).toBe("2026-03-27 10:00:00");
    expect(e.taskId).toBe("TASK-001");
    expect(e.phase).toBe("task");
    expect(e.model).toBe("claude-sonnet-4-20250514");
    expect(e.inputTokens).toBe(1500);
    expect(e.cacheCreate).toBe(100);
    expect(e.cacheRead).toBe(0);
    expect(e.outputTokens).toBe(2400);
    expect(e.turns).toBe(3);
    expect(e.durationMs).toBe(5230);
    expect(e.costUsd).toBeCloseTo(0.045, 6);
  });

  it("produces a summary by task", () => {
    const { summaryByTask } = parseCostLog();
    expect(summaryByTask).toHaveLength(1);
    const s = summaryByTask[0];
    expect(s.taskId).toBe("TASK-001");
    expect(s.totalInputTokens).toBe(1500);
    expect(s.totalOutputTokens).toBe(2400);
    expect(s.totalTurns).toBe(3);
    expect(s.totalCostUsd).toBeCloseTo(0.045, 6);
    expect(s.models).toBe("claude-sonnet-4-20250514");
    expect(s.entries).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────
// parseCostLog — legacy format (without model)
// ──────────────────────────────────────────────────────────────
describe("parseCostLog — legacy format without model", () => {
  const legacyLine =
    "[2026-03-20 08:00:00] TASK-050 | phase=review | input=500 cache_create=0 cache_read=200 output=800 | turns=1 | duration=1200ms | cost=$0.012";

  beforeEach(() => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(legacyLine + "\n");
  });

  it("parses a legacy line and sets model to 'unknown'", () => {
    const { entries } = parseCostLog();
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.model).toBe("unknown");
    expect(e.taskId).toBe("TASK-050");
    expect(e.phase).toBe("review");
    expect(e.inputTokens).toBe(500);
    expect(e.cacheRead).toBe(200);
    expect(e.outputTokens).toBe(800);
    expect(e.turns).toBe(1);
    expect(e.costUsd).toBeCloseTo(0.012, 6);
  });

  it("sets models to 'unknown' in summary", () => {
    const { summaryByTask } = parseCostLog();
    expect(summaryByTask[0].models).toBe("unknown");
  });
});

// ──────────────────────────────────────────────────────────────
// parseCostLog — model_selection lines are skipped
// ──────────────────────────────────────────────────────────────
describe("parseCostLog — model_selection filtering", () => {
  it("skips lines containing model_selection", () => {
    mockExistsSync.mockReturnValue(true);
    const lines = [
      "[2026-03-27 10:00:00] TASK-001 | phase=model_selection | model=claude-opus | input=0 cache_create=0 cache_read=0 output=0 | turns=0 | duration=0ms | cost=$0.000",
      "[2026-03-27 10:01:00] TASK-001 | phase=task | model=claude-sonnet-4-20250514 | input=100 cache_create=0 cache_read=0 output=100 | turns=1 | duration=500ms | cost=$0.001",
    ].join("\n");
    mockReadFileSync.mockReturnValue(lines);

    const { entries } = parseCostLog();
    expect(entries).toHaveLength(1);
    expect(entries[0].phase).toBe("task");
  });
});

// ──────────────────────────────────────────────────────────────
// parseCostLog — multiple tasks aggregation
// ──────────────────────────────────────────────────────────────
describe("parseCostLog — multiple tasks", () => {
  it("aggregates multiple entries per task", () => {
    mockExistsSync.mockReturnValue(true);
    const lines = [
      "[2026-03-27 10:00:00] TASK-001 | phase=task | model=claude-sonnet-4-20250514 | input=1000 cache_create=0 cache_read=0 output=1000 | turns=2 | duration=2000ms | cost=$0.020",
      "[2026-03-27 11:00:00] TASK-001 | phase=review | model=claude-opus-4-20250514 | input=500 cache_create=0 cache_read=0 output=500 | turns=1 | duration=1000ms | cost=$0.010",
      "[2026-03-27 10:00:00] TASK-002 | phase=task | model=claude-sonnet-4-20250514 | input=200 cache_create=0 cache_read=0 output=200 | turns=1 | duration=500ms | cost=$0.002",
    ].join("\n");
    mockReadFileSync.mockReturnValue(lines);

    const { summaryByTask } = parseCostLog();
    expect(summaryByTask).toHaveLength(2);

    const task1 = summaryByTask.find((s) => s.taskId === "TASK-001")!;
    expect(task1).toBeDefined();
    expect(task1.entries).toBe(2);
    expect(task1.totalInputTokens).toBe(1500);
    expect(task1.totalTurns).toBe(3);
    expect(task1.totalCostUsd).toBeCloseTo(0.03, 6);
    expect(task1.models).toContain("claude-sonnet-4-20250514");
    expect(task1.models).toContain("claude-opus-4-20250514");

    const task2 = summaryByTask.find((s) => s.taskId === "TASK-002")!;
    expect(task2).toBeDefined();
    expect(task2.entries).toBe(1);
    expect(task2.totalCostUsd).toBeCloseTo(0.002, 6);
  });
});

// ──────────────────────────────────────────────────────────────
// parseCostLog — invalid / empty lines
// ──────────────────────────────────────────────────────────────
describe("parseCostLog — malformed lines", () => {
  it("skips empty lines", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("\n\n\n");
    expect(parseCostLog().entries).toHaveLength(0);
  });

  it("skips lines that do not match either regex", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("some random text\nanother bad line\n");
    expect(parseCostLog().entries).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────
// parseCostLog — entries sorted newest first
// ──────────────────────────────────────────────────────────────
describe("parseCostLog — sort order", () => {
  it("returns entries sorted newest first", () => {
    mockExistsSync.mockReturnValue(true);
    const lines = [
      "[2026-03-27 10:00:00] TASK-001 | phase=task | model=m | input=10 cache_create=0 cache_read=0 output=10 | turns=1 | duration=100ms | cost=$0.001",
      "[2026-03-27 12:00:00] TASK-001 | phase=review | model=m | input=10 cache_create=0 cache_read=0 output=10 | turns=1 | duration=100ms | cost=$0.001",
    ].join("\n");
    mockReadFileSync.mockReturnValue(lines);

    const { entries } = parseCostLog();
    expect(entries[0].timestamp).toBe("2026-03-27 12:00:00");
    expect(entries[1].timestamp).toBe("2026-03-27 10:00:00");
  });
});
