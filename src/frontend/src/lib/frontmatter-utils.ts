import matter from "gray-matter";

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

/**
 * gray-matter를 사용해 frontmatter와 body를 파싱한다.
 * 실패 시 { data: {}, content: "" } 반환.
 */
export function parseFrontmatter(raw: string): ParsedFrontmatter {
  try {
    const { data, content } = matter(raw);
    return { data: data as Record<string, unknown>, content: content.trim() };
  } catch {
    return { data: {}, content: "" };
  }
}

/** data에서 문자열 값을 안전하게 꺼낸다. 없으면 fallback 반환.
 *  gray-matter가 날짜를 Date 객체로 파싱하는 경우 "YYYY-MM-DD" 형식으로 변환한다. */
export function getString(
  data: Record<string, unknown>,
  key: string,
  fallback = "",
): string {
  const val = data[key];
  if (val === null || val === undefined) return fallback;
  if (val instanceof Date) {
    // "YYYY-MM-DD" 포맷으로 변환 (로컬 시간 기준)
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  return str || fallback;
}

/** data에서 boolean 값을 안전하게 꺼낸다. */
export function getBool(
  data: Record<string, unknown>,
  key: string,
  fallback = false,
): boolean {
  const val = data[key];
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val.trim() === "true";
  return fallback;
}

/** data에서 정수 값을 안전하게 꺼낸다. */
export function getInt(
  data: Record<string, unknown>,
  key: string,
  fallback = 0,
): number {
  const val = data[key];
  if (typeof val === "number") return Math.trunc(val);
  if (typeof val === "string") {
    const parsed = parseInt(val.trim(), 10);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

/** data에서 string[] 값을 안전하게 꺼낸다. YAML 배열 및 단일 문자열 모두 처리. */
export function getStringArray(
  data: Record<string, unknown>,
  key: string,
): string[] {
  const val = data[key];
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  if (typeof val === "string" && val.trim()) return [val.trim()];
  return [];
}
