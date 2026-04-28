"use client";

import { useEffect, useMemo, useRef } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogsStore } from "@/store/logsStore";
import type { LogLine, UiLogRow } from "./type";
import { parseOrchestrateUiRow } from "./utils";
import { MAX_LOG_LINES } from "./const";

type UiLogRowWithId = UiLogRow & { id: number };

export function OrchestrateLogViewer({ title }: { title?: string }) {
  const lines = useLogsStore((s) => s.lines);
  const status = useLogsStore((s) => s.status);
  const connected = useLogsStore((s) => s.connected);
  const clear = useLogsStore((s) => s.clear);
  const logBodyRef = useRef<HTMLDivElement>(null);

  const lineCount = lines.length;
  const canClear = lineCount > 0;

  const headerTitle = title ?? "Logs";

  const rows = useMemo<UiLogRowWithId[]>(
    () => lines.map((l) => ({ id: l.id, ...parseOrchestrateUiRow(l) })),
    [lines],
  );

  const headerRight = useMemo(() => {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canClear}
          onClick={() => {
            clear();
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
  }, [canClear, clear]);

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

