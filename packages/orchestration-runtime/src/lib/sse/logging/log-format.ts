export type LogLevel = "info";

export type LogSource = string;

function formatHms(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * Canonical log line format (OpenClaw-ish):
 *   "HH:MM:SS info <source> <message>"
 */
export function formatLogLine(opts: {
  at?: Date;
  level?: LogLevel;
  source: LogSource;
  message: string;
}): string {
  const at = opts.at ?? new Date();
  const level: LogLevel = opts.level ?? "info";
  const source = opts.source.trim() || "orchestrate";
  const message = opts.message.trim();
  return `${formatHms(at)} ${level} ${source} ${message}`;
}

/**
 * Normalize arbitrary log text into the canonical format.
 * - Leaves canonical "HH:MM:SS info <source> ..." lines intact.
 * - Converts "ISO INFO ..." lines into canonical lines (source provided or default).
 * - Converts "[source] message" lines into canonical lines using the bracket source.
 * - Otherwise wraps the text as canonical with the provided/default source.
 */
export function normalizeLogLine(
  line: string,
  opts?: { defaultSource?: string; at?: Date },
): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return formatLogLine({
      at: opts?.at,
      source: opts?.defaultSource ?? "orchestrate",
      message: "",
    });
  }

  // Canonical already.
  if (/^\d{2}:\d{2}:\d{2}\s+info\s+\S+\s+/i.test(trimmed)) return trimmed;

  // ISO INFO line: "2026-04-22T05:46:13.805Z INFO Engine started"
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2}T[^\s]+)\s+INFO\s+(.*)$/i);
  if (iso) {
    const [, isoTs, msg] = iso;
    const d = new Date(isoTs);
    return formatLogLine({
      at: Number.isNaN(d.getTime()) ? opts?.at : d,
      source: opts?.defaultSource ?? "engine",
      message: msg,
    });
  }

  // Bracket source: "[dashboard] Run requested"
  const bracket = trimmed.match(/^\[([^\]]+)\]\s+(.*)$/);
  if (bracket) {
    const [, src, msg] = bracket;
    return formatLogLine({
      at: opts?.at,
      source: src,
      message: msg,
    });
  }

  return formatLogLine({
    at: opts?.at,
    source: opts?.defaultSource ?? "orchestrate",
    message: trimmed,
  });
}

