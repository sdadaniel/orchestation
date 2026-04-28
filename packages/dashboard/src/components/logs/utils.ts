import type { LogLine, UiLogRow } from "./type";
import { LOG_LINE_PATTERNS } from "./const";

function formatHmsFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function parseOrchestrateUiRow(entry: LogLine): UiLogRow {
  const line = entry.line;
  // Format 0 (OpenClaw-ish): "HH:MM:SS info engine message..."
  const h = line.match(LOG_LINE_PATTERNS.hmsInfo);
  if (h) {
    const [, time, source, msg] = h;
    return {
      time,
      level: "info",
      source: source.trim(),
      message: msg.trim(),
    };
  }

  // Format A: "2026-04-22T05:46:13.805Z INFO Engine started"
  const m = line.match(LOG_LINE_PATTERNS.isoInfo);
  if (m) {
    const [, iso, msg] = m;
    return {
      time: formatHmsFromIso(iso),
      level: "info",
      source: "engine",
      message: msg.trim(),
    };
  }

  // Format B: "[orchestrate] Starting Node.js engine"
  const b = line.match(LOG_LINE_PATTERNS.bracket);
  if (b) {
    return {
      time: formatHmsFromIso(entry.receivedAtIso),
      level: "info",
      source: b[1].trim(),
      message: b[2].trim(),
    };
  }

  // Default
  return {
    time: formatHmsFromIso(entry.receivedAtIso),
    level: "info",
    source: "orchestrate",
    message: line,
  };
}

