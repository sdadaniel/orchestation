"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_LOG_LINES = 200;

type StreamEvent = {
  logs?: string[];
  total?: number;
  status?: string;
  finishedAt?: string;
};

type LogLine = {
  id: number;
  receivedAtIso: string;
  line: string;
};

type UiLogRow = {
  time: string; // "HH:MM:SS" or "--:--:--"
  level: "info";
  source: string; // e.g. "engine" | "dashboard" | "orchestrate"
  message: string;
};

type UiLogRowWithId = UiLogRow & { id: number };

function formatHmsFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function parseUiRow(entry: LogLine): UiLogRow {
  const line = entry.line;
  // Format 0 (OpenClaw-ish): "HH:MM:SS info engine message..."
  const hmsInfo = /^(\d{2}:\d{2}:\d{2})\s+info\s+(\S+)\s+(.*)$/i;
  const h = line.match(hmsInfo);
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
  const isoInfo = /^(\d{4}-\d{2}-\d{2}T[^\s]+)\s+INFO\s+(.*)$/i;
  const m = line.match(isoInfo);
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
  const bracket = /^\[([^\]]+)\]\s+(.*)$/;
  const b = line.match(bracket);
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

export function OrchestrateLogViewer({ title }: { title?: string }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<string>("idle");
  const [connected, setConnected] = useState(false);
  const logBodyRef = useRef<HTMLDivElement>(null);
  const lastStatusRef = useRef<string>("idle");
  const knownIdsRef = useRef<Set<number>>(new Set());
  const lastTotalRef = useRef<number | null>(null);

  const lineCount = lines.length;
  const canClear = lineCount > 0;

  const headerTitle = title ?? "Logs";

  const rows = useMemo<UiLogRowWithId[]>(
    () => lines.map((l) => ({ id: l.id, ...parseUiRow(l) })),
    [lines],
  );

  const headerRight = useMemo(() => {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canClear}
          onClick={() => {
            knownIdsRef.current = new Set();
            setLines([]);
          }}
          className={cn(
            "filter-pill text-xs flex items-center gap-1.5",
            !canClear && "opacity-40 pointer-events-none",
          )}
        >
          <Trash2 className="h-3 w-3" />
          비우기
        </button>
      </div>
    );
  }, [canClear]);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let es: EventSource | null = null;

    async function loadInitial() {
      try {
        const res = await fetch("/api/orchestrate/logs?since=0");
        if (!res.ok) return;
        const data = (await res.json()) as {
          logs?: string[];
          status?: string;
          total?: number;
        };
        if (cancelled) return;

        const initialLines = Array.isArray(data.logs) ? data.logs : [];
        if (typeof data.status === "string") {
          lastStatusRef.current = data.status;
          setStatus(data.status);
        }
        if (initialLines.length > 0) {
          const receivedAtIso = new Date().toISOString();
          const capped =
            initialLines.length > MAX_LOG_LINES
              ? initialLines.slice(initialLines.length - MAX_LOG_LINES)
              : initialLines;
          const total = typeof data.total === "number" ? data.total : initialLines.length;
          const startId = Math.max(0, total - capped.length);
          const entries = capped.map((line, idx) => ({
            id: startId + idx,
            receivedAtIso,
            line,
          }));
          // 최신 로그가 위로 오도록(내림차순) 초기 로딩도 reverse 한다.
          setLines(entries.reverse());
          // SSE dedupe와 동일한 기준으로 초기 로딩분을 known set에 넣어둔다.
          const nextKnown = new Set<number>();
          for (const e of entries) nextKnown.add(e.id);
          knownIdsRef.current = nextKnown;
          lastTotalRef.current = total;
        } else {
          const total = typeof data.total === "number" ? data.total : 0;
          lastTotalRef.current = total;
        }
      } catch {
        /* ignore */
      }
    }

    const applyIncoming = (payload: { logs?: string[]; total?: number }) => {
      const newLogs = Array.isArray(payload.logs) ? payload.logs : [];
      const total = typeof payload.total === "number" ? payload.total : null;

      if (total !== null) {
        // 서버 total이 증가하는 절대 인덱스이므로, cursor도 그 기준으로 유지한다.
        // total이 뒤로 가는 경우는 dev/HMR 등 비정상 케이스인데, 이 경우 dedupe/라인을 초기화한다.
        if (lastTotalRef.current !== null && total < lastTotalRef.current) {
          knownIdsRef.current = new Set();
          setLines([]);
        }
        lastTotalRef.current = total;
      }

      if (newLogs.length === 0) return;

      setLines((prev) => {
        const receivedAtIso = new Date().toISOString();
        const startId =
          total !== null ? Math.max(0, total - newLogs.length) : Date.now();

        const nextEntries: LogLine[] = newLogs.map((line, i) => {
          const id = startId + i;
          return { id, receivedAtIso, line };
        });

        // 화면이 비어있는 상태에서 logs payload를 받았는데도 표시가 안 되는 케이스를 방지한다.
        // (예: knownIds/중복 처리와 엮인 상태 꼬임)
        if (prev.length === 0) {
          const nextKnown = new Set<number>();
          for (const e of nextEntries) nextKnown.add(e.id);
          knownIdsRef.current = nextKnown;
          return nextEntries.slice().reverse();
        }

        const fresh: LogLine[] = [];
        for (const e of nextEntries) {
          if (knownIdsRef.current.has(e.id)) continue;
          knownIdsRef.current.add(e.id);
          fresh.push(e);
        }

        const merged = [...fresh.reverse(), ...prev];
        const clipped =
          merged.length > MAX_LOG_LINES ? merged.slice(0, MAX_LOG_LINES) : merged;

        if (clipped.length < merged.length) {
          const nextKnown = new Set<number>();
          for (const l of clipped) nextKnown.add(l.id);
          knownIdsRef.current = nextKnown;
        }

        return clipped;
      });

    };

    loadInitial();

    const scheduleReconnect = () => {
      if (cancelled) return;
      if (reconnectTimer) return;
      reconnectAttempt += 1;
      const ms = Math.min(10_000, 500 * 2 ** Math.min(6, reconnectAttempt));
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, ms);
    };

    const connect = () => {
      if (cancelled) return;
      try {
        es?.close();
      } catch {
        /* ignore */
      }

      es = new EventSource("/api/orchestrate/logs?stream=true");
      es.onopen = () => {
        reconnectAttempt = 0;
        setConnected(true);
      };

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as StreamEvent;
          if (typeof data.status === "string") {
            lastStatusRef.current = data.status;
            setStatus(data.status);
          }
          applyIncoming({ logs: data.logs, total: data.total });
        } catch {
          // ignore parse failures
        }
      };

      es.onerror = () => {
        setConnected(false);
        // 기존 로그는 그대로 두고 재연결을 시도한다.
        try {
          es?.close();
        } catch {
          /* ignore */
        }
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        es?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    const el = logBodyRef.current;
    if (el) el.scrollTop = 0;
  }, [lineCount]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{headerTitle}</h2>
        {headerRight}
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-background">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
          <span className="text-[11px] text-muted-foreground font-mono">
            orchestrate — {status}
          </span>
          <span className="text-[10px] text-muted-foreground/70 ml-auto font-mono">
            {connected ? "connected" : "disconnected"} · {lineCount}/{MAX_LOG_LINES}
          </span>
        </div>

        <div
          ref={logBodyRef}
          className="max-h-[500px] overflow-y-auto scrollbar-hide"
        >
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[72px_56px_120px_1fr] gap-3 px-3 py-2 text-[12px] bg-background"
              >
                <div className="font-mono text-muted-foreground">{r.time}</div>

                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-muted text-[11px] text-muted-foreground">
                    info
                  </span>
                </div>

                <div className="font-mono text-muted-foreground truncate">
                  {r.source}
                </div>

                <div className="text-foreground whitespace-pre-wrap break-words">
                  {r.message}
                </div>
              </div>
            ))}

            {rows.length === 0 ? (
              <div className="px-3 py-6 text-sm text-muted-foreground">
                (no logs yet)
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

