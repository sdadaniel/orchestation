/**
 * Extracts a human-readable error message from an unknown error value.
 * Replaces the repeated `err instanceof Error ? err.message : "fallback"` pattern.
 *
 * @param error - The caught error (unknown type)
 * @param fallback - Fallback message when error is not an Error instance (default: "알 수 없는 오류가 발생했습니다.")
 * @param options - Additional options
 * @param options.log - When true, logs the original error object via console.error
 */
export function getErrorMessage(
  error: unknown,
  fallback = "알 수 없는 오류가 발생했습니다.",
  options?: { log?: boolean },
): string {
  if (options?.log) {
    console.error(error);
  }
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.length > 0) return error;
  return fallback;
}
