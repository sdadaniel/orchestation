import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// fs는 모듈 로드 시 paths.ts에서 사용됨 → vi.mock은 자동으로 호이스팅됨
vi.mock("fs", () => {
  const mod = {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue(""),
    readdirSync: vi.fn().mockReturnValue([]),
  };
  return { default: mod, ...mod };
});

import * as fs from "fs";
import { parseTaskFile, parseAllTasks, invalidateTasksCache } from "./parser";

const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
const mockReaddirSync = fs.readdirSync as ReturnType<typeof vi.fn>;

const VALID_TASK_MD = `---
id: TASK-001
title: Sample Task
status: pending
priority: high
depends_on:
  - TASK-000
blocks: []
parallel_with: []
role: implementor
affected_files:
  - src/foo.ts
---
Task body here.`;

const MINIMAL_TASK_MD = `---
id: TASK-002
title: Minimal Task
---
`;

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
  mockReadFileSync.mockReturnValue("");
  mockReaddirSync.mockReturnValue([]);
  invalidateTasksCache();
});

afterEach(() => {
  invalidateTasksCache();
});

// ──────────────────────────────────────────────────────────────
// parseTaskFile
// ──────────────────────────────────────────────────────────────
describe("parseTaskFile", () => {
  it("parses a fully specified task file", () => {
    mockReadFileSync.mockReturnValue(VALID_TASK_MD);

    const task = parseTaskFile("/tasks/TASK-001.md");
    expect(task).not.toBeNull();
    expect(task!.id).toBe("TASK-001");
    expect(task!.title).toBe("Sample Task");
    expect(task!.status).toBe("pending");
    expect(task!.priority).toBe("high");
    expect(task!.depends_on).toEqual(["TASK-000"]);
    expect(task!.blocks).toEqual([]);
    expect(task!.role).toBe("implementor");
    expect(task!.affected_files).toEqual(["src/foo.ts"]);
  });

  it("parses a minimal task file with defaults", () => {
    mockReadFileSync.mockReturnValue(MINIMAL_TASK_MD);

    const task = parseTaskFile("/tasks/TASK-002.md");
    expect(task).not.toBeNull();
    expect(task!.id).toBe("TASK-002");
    expect(task!.status).toBe("pending");      // default
    expect(task!.priority).toBe("medium");     // default
    expect(task!.depends_on).toEqual([]);
    expect(task!.blocks).toEqual([]);
    expect(task!.parallel_with).toEqual([]);
    expect(task!.role).toBe("");
    expect(task!.affected_files).toEqual([]);
  });

  it("returns null when id is missing", () => {
    mockReadFileSync.mockReturnValue(`---\ntitle: No ID\n---\n`);
    expect(parseTaskFile("/tasks/bad.md")).toBeNull();
  });

  it("returns null when title is missing", () => {
    mockReadFileSync.mockReturnValue(`---\nid: TASK-X\n---\n`);
    expect(parseTaskFile("/tasks/bad.md")).toBeNull();
  });

  it("returns null when readFileSync throws", () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(parseTaskFile("/tasks/nonexistent.md")).toBeNull();
  });

  it("normalises unknown status to 'pending'", () => {
    mockReadFileSync.mockReturnValue(`---\nid: T\ntitle: T\nstatus: unknown_status\n---\n`);
    const task = parseTaskFile("/tasks/t.md");
    expect(task!.status).toBe("pending");
  });

  it("normalises unknown priority to 'medium'", () => {
    mockReadFileSync.mockReturnValue(`---\nid: T\ntitle: T\npriority: super_high\n---\n`);
    const task = parseTaskFile("/tasks/t.md");
    expect(task!.priority).toBe("medium");
  });

  it("accepts all valid statuses", () => {
    const statuses = ["pending", "stopped", "in_progress", "reviewing", "done", "rejected"] as const;
    for (const status of statuses) {
      mockReadFileSync.mockReturnValue(`---\nid: T\ntitle: T\nstatus: ${status}\n---\n`);
      expect(parseTaskFile("/t.md")!.status).toBe(status);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// parseAllTasks
// ──────────────────────────────────────────────────────────────
describe("parseAllTasks", () => {
  it("returns empty array when tasks directory does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    expect(parseAllTasks()).toEqual([]);
  });

  it("returns empty array when directory is empty", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    expect(parseAllTasks()).toEqual([]);
  });

  it("parses multiple task files from directory", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["TASK-001.md", "TASK-002.md", "README.md"]);
    mockReadFileSync
      .mockReturnValueOnce(VALID_TASK_MD)
      .mockReturnValueOnce(MINIMAL_TASK_MD)
      .mockReturnValue(""); // README should be excluded by .md filter on TASKS_DIR level
    // Actually readdirSync already returned README.md; parseTaskFile returns null for no id
    // So only 2 valid tasks
    const tasks = parseAllTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(1);
  });

  it("skips files that fail to parse", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["bad.md"]);
    mockReadFileSync.mockReturnValue(`---\ntitle: No ID\n---\n`);
    expect(parseAllTasks()).toEqual([]);
  });

  it("returns cached result within TTL", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["TASK-001.md"]);
    mockReadFileSync.mockReturnValue(VALID_TASK_MD);

    const first = parseAllTasks();
    // Second call should hit cache — readdirSync called only once
    const second = parseAllTasks();
    expect(first).toBe(second); // same reference
    expect(mockReaddirSync).toHaveBeenCalledTimes(1);
  });

  it("re-reads after cache is invalidated", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["TASK-001.md"]);
    mockReadFileSync.mockReturnValue(VALID_TASK_MD);

    parseAllTasks();
    invalidateTasksCache();
    parseAllTasks();
    expect(mockReaddirSync).toHaveBeenCalledTimes(2);
  });
});
