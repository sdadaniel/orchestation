/**
 * Extracts a human-readable error message from an unknown error value.
 * Replaces the repeated `err instanceof Error ? err.message : "fallback"` pattern.
 *
 * @param error - The caught error (unknown type)
 * @param defaultMessage - Fallback message when error is not an Error instance (default: "알 수 없는 오류가 발생했습니다.")
 * @param options - Additional options
 * @param options.log - When true, logs the original error object via console.error
 */
export function getErrorMessage(
  error: unknown,
  defaultMessage = "알 수 없는 오류가 발생했습니다.",
  options?: { log?: boolean },
): string {
  if (options?.log) {
    console.error(error);
  }
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.length > 0) return error;
  return defaultMessage;
}

/**
 * Options for structured API error responses.
 * Allows attaching machine-readable `code` and debug `details` alongside the human-readable message.
 *
 * @example
 * jsonErrorResponse({ error: "title is required", status: 400, code: "INVALID_INPUT" })
 * jsonErrorResponse({ error: "Analysis timed out", status: 504, code: "TIMEOUT" })
 */
export interface ApiErrorOptions {
  error: string;
  /** HTTP status code (default: 400) */
  status?: number;
  /** Machine-readable error code, e.g. "INVALID_INPUT", "TIMEOUT", "NOT_FOUND" */
  code?: string;
  /** Optional debug information (omitted from response when undefined) */
  details?: unknown;
}

/**
 * Creates a JSON error Response.
 * Replaces the repeated `new Response(JSON.stringify({ error }), { status, headers })` pattern.
 *
 * Accepts either a plain string or an `ApiErrorOptions` object for structured responses.
 *
 * @param opts - Error message string or structured options
 * @param status - HTTP status code (default: 400). Ignored when opts is an object with `status` set.
 */
export function jsonErrorResponse(
  opts: string | ApiErrorOptions,
  status = 400,
): Response {
  let body: Record<string, unknown>;
  let finalStatus: number;

  if (typeof opts === "string") {
    body = { error: opts };
    finalStatus = status;
  } else {
    body = { error: opts.error };
    if (opts.code !== undefined) body.code = opts.code;
    if (opts.details !== undefined) body.details = opts.details;
    finalStatus = opts.status ?? status;
  }

  return new Response(JSON.stringify(body), {
    status: finalStatus,
    headers: { "Content-Type": "application/json" },
  });
}
