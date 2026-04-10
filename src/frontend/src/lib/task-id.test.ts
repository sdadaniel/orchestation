import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateNextTaskId } from "./task-id";
import fs from "fs";

// Mock fs module
vi.mock("fs");

describe("task-id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateNextTaskId", () => {
    it("should return TASK-001 when no existing task files", () => {
      vi.mocked(fs.readdirSync).mockReturnValue([] as any);

      const result = generateNextTaskId("/tmp/tasks");
      expect(result).toBe("TASK-001");
    });

    it("should return next ID with zero-padding", () => {
      vi.mocked(fs.readdirSync).mockReturnValue([
        "TASK-001.md",
        "TASK-002.md",
        "TASK-010.md",
      ] as any);

      const result = generateNextTaskId("/tmp/tasks");
      expect(result).toBe("TASK-011");
    });

    it("should find max number across multiple files", () => {
      vi.mocked(fs.readdirSync).mockReturnValue([
        "TASK-005.md",
        "TASK-100.md",
        "TASK-050.md",
      ] as any);

      const result = generateNextTaskId("/tmp/tasks");
      expect(result).toBe("TASK-101");
    });

    it("should ignore non-TASK files", () => {
      vi.mocked(fs.readdirSync).mockReturnValue([
        "TASK-001.md",
        "README.md",
        "config.json",
        "TASK-002.md",
      ] as any);

      const result = generateNextTaskId("/tmp/tasks");
      expect(result).toBe("TASK-003");
    });

    it("should ignore files without .md extension", () => {
      vi.mocked(fs.readdirSync).mockReturnValue([
        "TASK-001.md",
        "TASK-002.txt",
        "TASK-003",
      ] as any);

      const result = generateNextTaskId("/tmp/tasks");
      expect(result).toBe("TASK-002");
    });

    it("should handle large task numbers", () => {
      vi.mocked(fs.readdirSync).mockReturnValue(["TASK-999.md"] as any);

      const result = generateNextTaskId("/tmp/tasks");
      expect(result).toBe("TASK-1000");
    });
  });
});
