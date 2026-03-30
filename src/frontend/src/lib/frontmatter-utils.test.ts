import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  getString,
  getBool,
  getInt,
  getStringArray,
} from "./frontmatter-utils";

// ──────────────────────────────────────────────────────────────
// parseFrontmatter
// ──────────────────────────────────────────────────────────────
describe("parseFrontmatter", () => {
  it("parses valid YAML frontmatter and body", () => {
    const raw = `---
id: TASK-001
title: Hello World
status: pending
---
Body content here.`;
    const { data, content } = parseFrontmatter(raw);
    expect(data.id).toBe("TASK-001");
    expect(data.title).toBe("Hello World");
    expect(data.status).toBe("pending");
    expect(content).toBe("Body content here.");
  });

  it("returns empty data and content for empty string", () => {
    const { data, content } = parseFrontmatter("");
    expect(data).toEqual({});
    expect(content).toBe("");
  });

  it("returns content when no frontmatter delimiters exist", () => {
    const { data, content } = parseFrontmatter("just plain text");
    expect(data).toEqual({});
    expect(content).toBe("just plain text");
  });

  it("handles frontmatter with no body", () => {
    const raw = `---
key: value
---`;
    const { data, content } = parseFrontmatter(raw);
    expect(data.key).toBe("value");
    expect(content).toBe("");
  });

  it("trims whitespace from body content", () => {
    const raw = `---
x: 1
---

  trimmed  `;
    const { content } = parseFrontmatter(raw);
    expect(content).toBe("trimmed");
  });
});

// ──────────────────────────────────────────────────────────────
// getString
// ──────────────────────────────────────────────────────────────
describe("getString", () => {
  it("returns the string value", () => {
    expect(getString({ name: "hello" }, "name")).toBe("hello");
  });

  it("returns fallback for missing key", () => {
    expect(getString({}, "missing", "default")).toBe("default");
  });

  it("returns fallback for null value", () => {
    expect(getString({ k: null }, "k", "fb")).toBe("fb");
  });

  it("returns fallback for undefined value", () => {
    expect(getString({ k: undefined }, "k", "fb")).toBe("fb");
  });

  it("returns fallback for empty string", () => {
    expect(getString({ k: "" }, "k", "fb")).toBe("fb");
  });

  it("converts Date to YYYY-MM-DD format", () => {
    const d = new Date(2026, 2, 27); // March 27 2026, local
    const result = getString({ d }, "d");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe("2026-03-27");
  });

  it("converts number to string", () => {
    expect(getString({ n: 42 }, "n")).toBe("42");
  });
});

// ──────────────────────────────────────────────────────────────
// getBool
// ──────────────────────────────────────────────────────────────
describe("getBool", () => {
  it("returns true for boolean true", () => {
    expect(getBool({ f: true }, "f")).toBe(true);
  });

  it("returns false for boolean false", () => {
    expect(getBool({ f: false }, "f")).toBe(false);
  });

  it("returns true for string 'true'", () => {
    expect(getBool({ f: "true" }, "f")).toBe(true);
  });

  it("returns false for string 'false'", () => {
    expect(getBool({ f: "false" }, "f")).toBe(false);
  });

  it("returns false for arbitrary string", () => {
    expect(getBool({ f: "yes" }, "f")).toBe(false);
  });

  it("returns fallback for missing key", () => {
    expect(getBool({}, "missing", true)).toBe(true);
  });

  it("returns default fallback (false) when not provided", () => {
    expect(getBool({}, "missing")).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// getInt
// ──────────────────────────────────────────────────────────────
describe("getInt", () => {
  it("returns integer from number", () => {
    expect(getInt({ n: 42 }, "n")).toBe(42);
  });

  it("truncates float to integer", () => {
    expect(getInt({ n: 3.9 }, "n")).toBe(3);
  });

  it("parses integer from string", () => {
    expect(getInt({ n: "7" }, "n")).toBe(7);
  });

  it("returns fallback for NaN string", () => {
    expect(getInt({ n: "abc" }, "n", 99)).toBe(99);
  });

  it("returns fallback for missing key", () => {
    expect(getInt({}, "missing", 5)).toBe(5);
  });

  it("returns default fallback (0) when not provided", () => {
    expect(getInt({}, "missing")).toBe(0);
  });

  it("handles negative numbers", () => {
    expect(getInt({ n: -10 }, "n")).toBe(-10);
  });
});

// ──────────────────────────────────────────────────────────────
// getStringArray
// ──────────────────────────────────────────────────────────────
describe("getStringArray", () => {
  it("returns array of strings", () => {
    expect(getStringArray({ arr: ["a", "b"] }, "arr")).toEqual(["a", "b"]);
  });

  it("wraps single string in array", () => {
    expect(getStringArray({ arr: "item" }, "arr")).toEqual(["item"]);
  });

  it("returns empty array for missing key", () => {
    expect(getStringArray({}, "missing")).toEqual([]);
  });

  it("filters out empty strings", () => {
    expect(getStringArray({ arr: ["a", "", "b"] }, "arr")).toEqual(["a", "b"]);
  });

  it("returns empty for empty string value", () => {
    expect(getStringArray({ arr: "" }, "arr")).toEqual([]);
  });

  it("converts numbers to strings in array", () => {
    expect(getStringArray({ arr: [1, 2, 3] }, "arr")).toEqual(["1", "2", "3"]);
  });
});
