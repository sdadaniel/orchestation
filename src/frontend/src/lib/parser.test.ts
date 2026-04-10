import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseTaskFile, parseAllTasks, invalidateTasksCache } from "./parser";
import fs from "fs";

// Mock fs module
vi.mock("fs");

describe("parser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTasksCache();
  });

  describe("parseTaskFile", () => {
    it("should parse valid task file with all fields", () => {
      const content = `---
id: TASK-001
title: Test Task
status: done
priority: high
depends_on:
  - TASK-000
blocks: []
parallel_with: []
role: developer
affected_files:
  - src/index.ts
---
Task description`;

      vi.mocked(fs.readFileSync).mockReturnValue(content);

      const result = parseTaskFile("/tmp/test.md");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("TASK-001");
      expect(result?.title).toBe("Test Task");
      expect(result?.status).toBe("done");
      expect(result?.priority).toBe("high");
      expect(result?.depends_on).toEqual(["TASK-000"]);
    });

    it("should return null for missing id or title", () => {
      const content = `---
status: done
---
Missing id and title`;

      vi.mocked(fs.readFileSync).mockReturnValue(content);

      const result = parseTaskFile("/tmp/test.md");
      expect(result).toBeNull();
    });

    it("should default invalid status to pending", () => {
      const content = `---
id: TASK-002
title: Task
status: invalid_status
priority: high
---
Body`;

      vi.mocked(fs.readFileSync).mockReturnValue(content);

      const result = parseTaskFile("/tmp/test.md");
      expect(result?.status).toBe("pending");
    });

    it("should default invalid priority to medium", () => {
      const content = `---
id: TASK-003
title: Task
status: done
priority: invalid_priority
---
Body`;

      vi.mocked(fs.readFileSync).mockReturnValue(content);

      const result = parseTaskFile("/tmp/test.md");
      expect(result?.priority).toBe("medium");
    });

    it("should return null on file read error", () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("File not found");
      });

      const result = parseTaskFile("/tmp/nonexistent.md");
      expect(result).toBeNull();
    });
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
