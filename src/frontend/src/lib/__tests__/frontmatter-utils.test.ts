import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  getString,
  getBool,
  getInt,
  getStringArray,
} from "../frontmatter-utils";

describe("parseFrontmatter", () => {
  it("정상적인 frontmatter를 파싱한다", () => {
    const raw = `---
title: Hello
status: pending
---
본문 내용`;
    const result = parseFrontmatter(raw);
    expect(result.data.title).toBe("Hello");
    expect(result.data.status).toBe("pending");
    expect(result.content).toBe("본문 내용");
  });

  it("빈 문자열 입력 시 빈 data와 content를 반환한다", () => {
    const result = parseFrontmatter("");
    expect(result.data).toEqual({});
    expect(result.content).toBe("");
  });

  it("frontmatter 없는 일반 텍스트는 빈 data와 내용 반환", () => {
    const result = parseFrontmatter("그냥 텍스트");
    expect(result.data).toEqual({});
    expect(result.content).toBe("그냥 텍스트");
  });

  it("frontmatter만 있고 body가 없을 때", () => {
    const raw = `---
title: Only FM
---`;
    const result = parseFrontmatter(raw);
    expect(result.data.title).toBe("Only FM");
    expect(result.content).toBe("");
  });

  it("잘못된 YAML(숫자 키)도 파싱 실패 시 빈 값 반환", () => {
    // gray-matter가 파싱 예외를 던지는 케이스를 시뮬레이션
    // 실제로 gray-matter는 대부분을 파싱하므로 예외 경로는 try/catch로 검증
    const result = parseFrontmatter(null as unknown as string);
    expect(result.data).toEqual({});
    expect(result.content).toBe("");
  });
});

describe("getString", () => {
  it("일반 문자열 값을 반환한다", () => {
    expect(getString({ key: "value" }, "key")).toBe("value");
  });

  it("null 값은 fallback을 반환한다", () => {
    expect(getString({ key: null }, "key", "default")).toBe("default");
  });

  it("undefined 값은 fallback을 반환한다", () => {
    expect(getString({}, "missing", "fb")).toBe("fb");
  });

  it("빈 문자열은 fallback을 반환한다", () => {
    expect(getString({ key: "" }, "key", "fb")).toBe("fb");
  });

  it("공백만 있는 문자열은 fallback을 반환한다", () => {
    expect(getString({ key: "   " }, "key", "fb")).toBe("fb");
  });

  it("Date 객체를 YYYY-MM-DD 형식으로 변환한다", () => {
    const date = new Date(2026, 2, 28); // 2026-03-28 (월은 0-based)
    const result = getString({ date }, "date");
    expect(result).toBe("2026-03-28");
  });

  it("Date 객체 - 1월 1일 패딩 처리", () => {
    const date = new Date(2024, 0, 1); // 2024-01-01
    expect(getString({ date }, "date")).toBe("2024-01-01");
  });

  it("숫자 값은 문자열로 변환한다", () => {
    expect(getString({ n: 42 }, "n")).toBe("42");
  });

  it("fallback 기본값은 빈 문자열", () => {
    expect(getString({}, "missing")).toBe("");
  });
});

describe("getBool", () => {
  it("true boolean을 반환한다", () => {
    expect(getBool({ flag: true }, "flag")).toBe(true);
  });

  it("false boolean을 반환한다", () => {
    expect(getBool({ flag: false }, "flag", true)).toBe(false);
  });

  it("문자열 'true'를 true로 변환한다", () => {
    expect(getBool({ flag: "true" }, "flag")).toBe(true);
  });

  it("문자열 'false'를 false로 변환한다", () => {
    expect(getBool({ flag: "false" }, "flag", true)).toBe(false);
  });

  it("undefined는 fallback을 반환한다", () => {
    expect(getBool({}, "missing", true)).toBe(true);
  });

  it("기타 타입은 fallback을 반환한다", () => {
    expect(getBool({ flag: 1 }, "flag", false)).toBe(false);
  });

  it("fallback 기본값은 false", () => {
    expect(getBool({}, "missing")).toBe(false);
  });
});

describe("getInt", () => {
  it("정수 number를 반환한다", () => {
    expect(getInt({ n: 42 }, "n")).toBe(42);
  });

  it("소수점 number는 정수로 truncate한다", () => {
    expect(getInt({ n: 3.9 }, "n")).toBe(3);
  });

  it("음수 소수점도 truncate한다", () => {
    expect(getInt({ n: -3.9 }, "n")).toBe(-3);
  });

  it("문자열 숫자를 파싱한다", () => {
    expect(getInt({ n: "7" }, "n")).toBe(7);
  });

  it("앞뒤 공백 있는 문자열 숫자도 파싱한다", () => {
    expect(getInt({ n: "  15  " }, "n")).toBe(15);
  });

  it("NaN 문자열은 fallback을 반환한다", () => {
    expect(getInt({ n: "abc" }, "n", 99)).toBe(99);
  });

  it("undefined는 fallback을 반환한다", () => {
    expect(getInt({}, "missing", 5)).toBe(5);
  });

  it("fallback 기본값은 0", () => {
    expect(getInt({}, "missing")).toBe(0);
  });

  it("boolean 타입은 fallback을 반환한다", () => {
    expect(getInt({ n: true }, "n", 3)).toBe(3);
  });
});

describe("getStringArray", () => {
  it("string 배열을 그대로 반환한다", () => {
    expect(getStringArray({ arr: ["a", "b", "c"] }, "arr")).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("혼합 타입 배열을 string 배열로 변환한다", () => {
    expect(getStringArray({ arr: [1, true, "x"] }, "arr")).toEqual([
      "1",
      "true",
      "x",
    ]);
  });

  it("빈 문자열 요소는 필터링한다", () => {
    expect(getStringArray({ arr: ["a", "", "b"] }, "arr")).toEqual(["a", "b"]);
  });

  it("단일 문자열은 배열로 감싸서 반환한다", () => {
    expect(getStringArray({ arr: "single" }, "arr")).toEqual(["single"]);
  });

  it("빈 문자열 단일 값은 빈 배열 반환", () => {
    expect(getStringArray({ arr: "" }, "arr")).toEqual([]);
  });

  it("undefined는 빈 배열 반환", () => {
    expect(getStringArray({}, "missing")).toEqual([]);
  });

  it("null은 빈 배열 반환", () => {
    expect(getStringArray({ arr: null }, "arr")).toEqual([]);
  });

  it("숫자 값은 빈 배열 반환", () => {
    expect(getStringArray({ arr: 42 }, "arr")).toEqual([]);
  });
});
