import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  getString,
  getBool,
  getInt,
  getStringArray,
} from "./frontmatter-utils";

describe("frontmatter-utils", () => {
  describe("parseFrontmatter", () => {
    it("should parse valid YAML frontmatter", () => {
      const raw = `---
title: Test
status: done
---
# Body`;
      const result = parseFrontmatter(raw);
      expect(result.data.title).toBe("Test");
      expect(result.data.status).toBe("done");
      expect(result.content).toBe("# Body");
    });

    it("should handle text without frontmatter", () => {
      const raw = "just plain text";
      const result = parseFrontmatter(raw);
      expect(result.content).toBeTruthy();
    });
  });

  describe("getString", () => {
    it("should return string value", () => {
      const data = { name: "John" };
      expect(getString(data, "name")).toBe("John");
    });

    it("should return fallback for missing key", () => {
      const data = {};
      expect(getString(data, "name", "default")).toBe("default");
    });

    it("should convert Date object to YYYY-MM-DD", () => {
      const data = { date: new Date(2025, 0, 15) }; // Jan 15, 2025
      const result = getString(data, "date");
      expect(result).toBe("2025-01-15");
    });

    it("should trim and fallback for empty string", () => {
      const data = { empty: "   " };
      expect(getString(data, "empty", "fallback")).toBe("fallback");
    });
  });

  describe("getBool", () => {
    it("should return true boolean", () => {
      const data = { flag: true };
      expect(getBool(data, "flag")).toBe(true);
    });

    it("should return false boolean", () => {
      const data = { flag: false };
      expect(getBool(data, "flag")).toBe(false);
    });

    it("should convert string 'true' to boolean", () => {
      const data = { flag: "true" };
      expect(getBool(data, "flag")).toBe(true);
    });

    it("should return fallback for non-matching string", () => {
      const data = { flag: "false" };
      expect(getBool(data, "flag", true)).toBe(false);
    });

    it("should return fallback for missing key", () => {
      const data = {};
      expect(getBool(data, "flag", true)).toBe(true);
    });
  });

  describe("getInt", () => {
    it("should return integer value", () => {
      const data = { count: 42 };
      expect(getInt(data, "count")).toBe(42);
    });

    it("should truncate float to integer", () => {
      const data = { count: 42.9 };
      expect(getInt(data, "count")).toBe(42);
    });

    it("should parse string to integer", () => {
      const data = { count: "100" };
      expect(getInt(data, "count")).toBe(100);
    });

    it("should return fallback for unparseable string", () => {
      const data = { count: "abc" };
      expect(getInt(data, "count", -1)).toBe(-1);
    });

    it("should return fallback for missing key", () => {
      const data = {};
      expect(getInt(data, "count", 10)).toBe(10);
    });
  });

  describe("getStringArray", () => {
    it("should return array of strings", () => {
      const data = { tags: ["a", "b", "c"] };
      expect(getStringArray(data, "tags")).toEqual(["a", "b", "c"]);
    });

    it("should convert single string to array", () => {
      const data = { tags: "single" };
      expect(getStringArray(data, "tags")).toEqual(["single"]);
    });

    it("should return empty array for missing key", () => {
      const data = {};
      expect(getStringArray(data, "tags")).toEqual([]);
    });

    it("should filter out empty strings", () => {
      const data = { tags: ["a", "", "b"] };
      expect(getStringArray(data, "tags")).toEqual(["a", "b"]);
    });

    it("should return empty array for empty string", () => {
      const data = { tags: "   " };
      expect(getStringArray(data, "tags")).toEqual([]);
    });
  });
});
