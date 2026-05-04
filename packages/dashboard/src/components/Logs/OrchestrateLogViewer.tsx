"use client";

import { useEffect, useMemo, useRef } from "react";
import { useLogsStore } from "@/store/logsStore";
import type { LogLine } from "./type";
import { parseOrchestrateUiRow } from "./utils";
import { MAX_LOG_LINES } from "./const";
import type { UiLogRowWithId } from "./types";

export function OrchestrateLogViewer({ title }: { title?: string }) {
  const lines = useLogsStore((s) => s.lines);
  const status = useLogsStore((s) => s.status);
  const connected = useLogsStore((s) => s.connected);
  const logBodyRef = useRef<HTMLDivElement>(null);

  const lineCount = lines.length;

  const headerTitle = title ?? "Logs";

  const rows = useMemo<UiLogRowWithId[]>(
    () => lines.map((l) => ({ id: l.id, ...parseOrchestrateUiRow(l) })),
    [lines],
  );

  useEffect(() => {
    const el = logBodyRef.current;
    if (el) el.scrollTop = 0;
  }, [lineCount]);

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">{headerTitle}</h2>

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

