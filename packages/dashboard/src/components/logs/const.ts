export const MAX_LOG_LINES = 200;

export const LOG_LINE_PATTERNS = {
  // "HH:MM:SS info engine message..."
  hmsInfo: /^(\d{2}:\d{2}:\d{2})\s+info\s+(\S+)\s+(.*)$/i,
  // "2026-04-22T05:46:13.805Z INFO Engine started"
  isoInfo: /^(\d{4}-\d{2}-\d{2}T[^\s]+)\s+INFO\s+(.*)$/i,
  // "[orchestrate] Starting Node.js engine"
  bracket: /^\[([^\]]+)\]\s+(.*)$/,
} as const;

