"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeGatewayEvent } from "@/gateway-ws/provider";

const MAX_LOG_LINES = 200;

type StreamEvent = {
  type?: "log" | "status" | "ping";
  logs?: string[];
  log?: string;
  id?: number;
  total?: number;
  status?: string;
  finishedAt?: string;
  taskResults?: unknown;
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
  const lastMessageAtRef = useRef<number>(0);
  const maxSeenIdRef = useRef<number>(-1);

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
            maxSeenIdRef.current = -1;
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
        const startId = total !== null ? Math.max(0, total - newLogs.length) : -1;

        const nextEntries: LogLine[] = newLogs.map((line, i) => {
          const id = startId >= 0 ? startId + i : Date.now() + i;
          return { id, receivedAtIso, line };
        });

        // 화면이 비어있는 상태에서 logs payload를 받았는데도 표시가 안 되는 케이스를 방지한다.
        // (예: knownIds/중복 처리와 엮인 상태 꼬임)
        if (prev.length === 0) {
          const nextKnown = new Set<number>();
          for (const e of nextEntries) nextKnown.add(e.id);
          knownIdsRef.current = nextKnown;
          maxSeenIdRef.current = Math.max(
            maxSeenIdRef.current,
            nextEntries[nextEntries.length - 1]!.id,
          );
          return nextEntries.slice().reverse();
        }

        const maxIncomingId = nextEntries[nextEntries.length - 1]!.id;
        const newOnes = nextEntries.filter((e) => e.id > maxSeenIdRef.current);
        if (newOnes.length > 0) {
          maxSeenIdRef.current = Math.max(maxSeenIdRef.current, maxIncomingId);
          // knownIds가 꼬여 있어도 maxSeenId 기준으로는 새 로그이므로 강제 반영한다.
          const merged = [...newOnes.slice().reverse(), ...prev];
          const clipped =
            merged.length > MAX_LOG_LINES
              ? merged.slice(0, MAX_LOG_LINES)
              : merged;
          const nextKnown = new Set<number>();
          for (const l of clipped) nextKnown.add(l.id);
          knownIdsRef.current = nextKnown;
          return clipped;
        }

        const fresh: LogLine[] = [];
        for (const e of nextEntries) {
          if (knownIdsRef.current.has(e.id)) continue;
          knownIdsRef.current.add(e.id);
          fresh.push(e);
        }

        // 메시지는 들어왔는데 fresh가 0이면, knownIds가 꼬여 "새 로그"를 다 버리고 있는 상태일 수 있다.
        // 이때 incoming id가 현재 최상단보다 더 최신이면(=진짜 새 로그), dedupe 상태를 재동기화한다.
        if (fresh.length === 0) {
          const currentTopId = prev[0]?.id ?? -1;
          if (maxIncomingId > currentTopId) {
            const newer = nextEntries.filter((e) => e.id > currentTopId);
            const nextKnown = new Set<number>(knownIdsRef.current);
            for (const e of newer) nextKnown.add(e.id);
            knownIdsRef.current = nextKnown;

            const merged = [...newer.slice().reverse(), ...prev];
            return merged.length > MAX_LOG_LINES
              ? merged.slice(0, MAX_LOG_LINES)
              : merged;
          }
        }

        const merged = [...fresh.reverse(), ...prev];
        const clipped =
          merged.length > MAX_LOG_LINES ? merged.slice(0, MAX_LOG_LINES) : merged;

        if (clipped.length < merged.length) {
          const nextKnown = new Set<number>();
          for (const l of clipped) nextKnown.add(l.id);
          knownIdsRef.current = nextKnown;
        }

        if (fresh.length > 0) {
          maxSeenIdRef.current = Math.max(maxSeenIdRef.current, maxIncomingId);
        }
        return clipped;
      });
    };

    const applyIncomingLine = (id: string, line: string) => {
      const n = Number(id);
      const numeric = Number.isFinite(n) ? n : undefined;
      applyIncoming({ logs: [line], total: numeric !== undefined ? numeric + 1 : undefined });
    };

    const off = subscribeGatewayEvent((event, data, seq) => {
      if (cancelled) return;
      if (event === "orchestration-status") {
        const d = data as { status?: string };
        if (typeof d?.status === "string") setStatus(d.status);
        return;
      }
      if (event !== "log") return;
      const d = data as { scope?: string; line?: string };
      if (d?.scope !== "orchestrate" || typeof d?.line !== "string") return;
      applyIncomingLine(String(seq), d.line);
    });

    setConnected(true);

    return () => {
      cancelled = true;
      off();
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

