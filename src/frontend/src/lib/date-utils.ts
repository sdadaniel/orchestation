/**
 * Shared date/time formatting utilities.
 * Centralises the repeated getFullYear/getMonth/padStart chains that were
 * duplicated across task-db-sync.ts and route.ts.
 */

/**
 * Format a Date as "YYYY-MM-DD HH:MM:SS" (with seconds).
 * Used wherever a full timestamp is needed (e.g. DB created/updated fields).
 */
export function formatTimestamp(date: Date): string {
  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, "0")}-` +
    `${String(date.getDate()).padStart(2, "0")} ` +
    `${String(date.getHours()).padStart(2, "0")}:` +
    `${String(date.getMinutes()).padStart(2, "0")}:` +
    `${String(date.getSeconds()).padStart(2, "0")}`
  );
}

/**
 * Format a Date as "YYYY-MM-DD HH:MM" (without seconds).
 * Used where a shorter display timestamp is preferred (e.g. mtime fallbacks).
 */
export function formatDatetime(date: Date): string {
  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, "0")}-` +
    `${String(date.getDate()).padStart(2, "0")} ` +
    `${String(date.getHours()).padStart(2, "0")}:` +
    `${String(date.getMinutes()).padStart(2, "0")}`
  );
}

/**
 * Format a Date as "HH:MM" (time only).
 * Used as a suffix when a frontmatter date field contains only a date part.
 */
export function formatTime(date: Date): string {
  return (
    `${String(date.getHours()).padStart(2, "0")}:` +
    `${String(date.getMinutes()).padStart(2, "0")}`
  );
}
