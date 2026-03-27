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
import {
  isValidTaskId,
  taskExists,
  getTaskLogs,
  hasLogSources,
} from "./task-log-parser";

const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
const mockReaddirSync = fs.readdirSync as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
  mockReadFileSync.mockReturnValue("");
  mockReaddirSync.mockReturnValue([]);
});

// ──────────────────────────────────────────────────────────────
// isValidTaskId
// ──────────────────────────────────────────────────────────────
describe("isValidTaskId", () => {
  it("accepts standard TASK-NNN format", () => {
    expect(isValidTaskId("TASK-001")).toBe(true);
    expect(isValidTaskId("TASK-270")).toBe(true);
  });

  it("accepts alphanumeric with hyphens", () => {
    expect(isValidTaskId("my-task-1")).toBe(true);
    expect(isValidTaskId("A1")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidTaskId("")).toBe(false);
  });

  it("rejects strings longer than 100 characters", () => {
    expect(isValidTaskId("A".repeat(101))).toBe(false);
  });

  it("accepts exactly 100 characters", () => {
    expect(isValidTaskId("A".repeat(100))).toBe(true);
  });

  it("rejects IDs starting with a hyphen", () => {
    expect(isValidTaskId("-TASK")).toBe(false);
  });

  it("rejects IDs with spaces", () => {
    expect(isValidTaskId("TASK 001")).toBe(false);
  });

  it("rejects IDs with special characters", () => {
    expect(isValidTaskId("TASK/001")).toBe(false);
    expect(isValidTaskId("TASK..001")).toBe(false);
  });

  it("rejects non-string input", () => {
    // @ts-expect-error intentional wrong type
    expect(isValidTaskId(null)).toBe(false);
    // @ts-expect-error intentional wrong type
    expect(isValidTaskId(undefined)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// taskExists
// ──────────────────────────────────────────────────────────────
describe("taskExists", () => {
  it("returns false when tasks directory does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    expect(taskExists("TASK-001")).toBe(false);
  });

  it("returns true when task file exists", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["TASK-001.md", "TASK-002.md"]);
    expect(taskExists("TASK-001")).toBe(true);
  });

  it("returns false when task file does not exist", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["TASK-002.md"]);
    expect(taskExists("TASK-001")).toBe(false);
  });

  it("returns true when task file has a suffix (e.g. title slug)", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["TASK-001-my-task-title.md"]);
    expect(taskExists("TASK-001")).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// getTaskLogs (token-usage.log parsing)
// ──────────────────────────────────────────────────────────────
describe("getTaskLogs — token-usage.log", () => {
  it("returns empty array when no log sources exist", () => {
    mockExistsSync.mockReturnValue(false);
    expect(getTaskLogs("TASK-001")).toEqual([]);
  });

  it("parses a matching token-usage.log line", () => {
    mockExistsSync.mockImplementation((p: string) =>
      String(p).includes("token-usage.log")
    );
    const logLine =
      "[2026-03-27 10:00:00] TASK-001 | phase=task | turns=3 | duration=5000ms | cost=$0.045";
    mockReadFileSync.mockReturnValue(logLine + "\n");

    const logs = getTaskLogs("TASK-001");
    expect(logs.length).toBeGreaterThan(0);
    const entry = logs[0];
    expect(entry.timestamp).toBe("2026-03-27 10:00:00");
    expect(entry.level).toBe("info");
    expect(entry.message).toContain("phase=task");
    expect(entry.message).toContain("turns=3");
    expect(entry.message).toContain("cost=$0.045");
  });

  it("ignores lines from different task IDs", () => {
    mockExistsSync.mockImplementation((p: string) =>
      String(p).includes("token-usage.log")
    );
    const logLine =
      "[2026-03-27 10:00:00] TASK-999 | phase=task | turns=1 | duration=1000ms | cost=$0.001";
    mockReadFileSync.mockReturnValue(logLine + "\n");

    expect(getTaskLogs("TASK-001")).toEqual([]);
  });

  it("returns entries sorted by timestamp", () => {
    mockExistsSync.mockImplementation((p: string) =>
      String(p).includes("token-usage.log")
    );
    const lines = [
      "[2026-03-27 12:00:00] TASK-001 | phase=review | turns=2 | duration=2000ms | cost=$0.020",
      "[2026-03-27 10:00:00] TASK-001 | phase=task | turns=3 | duration=5000ms | cost=$0.045",
    ].join("\n");
    mockReadFileSync.mockReturnValue(lines);

    const logs = getTaskLogs("TASK-001");
    expect(logs[0].timestamp).toBe("2026-03-27 10:00:00");
    expect(logs[1].timestamp).toBe("2026-03-27 12:00:00");
  });
});

// ──────────────────────────────────────────────────────────────
// getTaskLogs — worker log file
// ──────────────────────────────────────────────────────────────
describe("getTaskLogs — worker log file", () => {
  it("parses worker log with timestamp prefix", () => {
    mockExistsSync.mockImplementation((p: string) =>
      String(p).includes("TASK-001.log")
    );
    const content = "[2026-03-27 09:00:00] Starting task execution\n[2026-03-27 09:01:00] Error: something failed\n";
    mockReadFileSync.mockReturnValue(content);

    const logs = getTaskLogs("TASK-001");
    expect(logs.length).toBe(2);
    expect(logs[0].level).toBe("info");
    expect(logs[1].level).toBe("error");
  });

  it("handles log lines without timestamp", () => {
    mockExistsSync.mockImplementation((p: string) =>
      String(p).includes("TASK-001.log")
    );
    mockReadFileSync.mockReturnValue("plain log line without timestamp\n");

    const logs = getTaskLogs("TASK-001");
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe("plain log line without timestamp");
  });
});

// ──────────────────────────────────────────────────────────────
// hasLogSources
// ──────────────────────────────────────────────────────────────
describe("hasLogSources", () => {
  it("returns false when no files exist", () => {
    mockExistsSync.mockReturnValue(false);
    expect(hasLogSources("TASK-001")).toBe(false);
  });

  it("returns true when token-usage.log contains taskId", () => {
    mockExistsSync.mockImplementation((p: string) =>
      String(p).includes("token-usage.log")
    );
    mockReadFileSync.mockReturnValue("TASK-001 | some log data");
    expect(hasLogSources("TASK-001")).toBe(true);
  });

  it("returns true when task json output file exists", () => {
    mockExistsSync.mockImplementation((p: string) =>
      String(p).endsWith("TASK-001-task.json")
    );
    expect(hasLogSources("TASK-001")).toBe(true);
  });

  it("returns false when log exists but does not contain taskId", () => {
    mockExistsSync.mockImplementation((p: string) =>
      String(p).includes("token-usage.log")
    );
    mockReadFileSync.mockReturnValue("TASK-999 | some other log");
    expect(hasLogSources("TASK-001")).toBe(false);
  });
});
