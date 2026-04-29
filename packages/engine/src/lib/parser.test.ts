import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseAllTasks, invalidateTasksCache } from "../parser/parser";
import fs from "fs";

// Mock fs module
vi.mock("fs");

describe("parser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTasksCache();
  });

  describe("parseAllTasks", () => {
    it("should return cached result within TTL", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "task1.md",
        "task2.md",
      ] as any);
      vi.mocked(fs.readFileSync).mockReturnValue(`---
id: TASK-001
title: Task
status: done
priority: high
---
Body`);

      const result1 = parseAllTasks();
      const result2 = parseAllTasks();

      expect(result1).toBe(result2); // Same reference (cached)
    });

    it("should return empty array if tasks dir does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = parseAllTasks();
      expect(result).toEqual([]);
    });
  });
});
