/**
 * 공용 포맷 유틸리티
 */

/**
 * ms를 사람이 읽기 좋은 시간 문자열로 변환한다 (시간 단위까지).
 * ex) 500 → "500ms", 3500 → "3.5s", 90000 → "1m 30s", 3700000 → "1h 1m"
 * RunHistory에서 사용.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${remainSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return `${hours}h ${remainMin}m`;
}

/**
 * ms를 사람이 읽기 좋은 시간 문자열로 변환한다 (분 단위까지).
 * ex) 500 → "500ms", 3500 → "3.5s", 90000 → "1m 30s", 3700000 → "61m 40s"
 * CostTable에서 사용.
 */
export function formatDurationMinutes(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = Math.round(seconds % 60);
  return `${minutes}m ${remainSec}s`;
}
