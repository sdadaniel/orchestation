/**
 * 공용 포맷 유틸리티
 */

/**
 * ms를 사람이 읽기 좋은 시간 문자열로 변환한다.
 * - "hours" (기본): 1h 1m 형태. RunHistory에서 사용.
 * - "minutes": 61m 40s 형태. CostTable에서 사용.
 */
export function formatDuration(
  ms: number,
  precision: "hours" | "minutes" = "hours",
): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = Math.round(seconds % 60);
  if (precision === "minutes" || minutes < 60)
    return `${minutes}m ${remainSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return `${hours}h ${remainMin}m`;
}

/** @deprecated Use formatDuration(ms, "minutes") instead */
export function formatDurationMinutes(ms: number): string {
  return formatDuration(ms, "minutes");
}
