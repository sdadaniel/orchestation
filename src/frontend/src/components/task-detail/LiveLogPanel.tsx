"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TERMINAL_BG, TERMINAL_HEADER_BG } from "@/constants/terminal";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export function LiveLogPanel({
  taskId,
  onStatusChange,
}: {
  taskId: string;
  onStatusChange?: (status: string) => void;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [waiting, setWaiting] = useState(true);
  const logBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/task-logs/${taskId}`,
    );

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "log" && msg.line) {
          setLines((prev) => [...prev, msg.line]);
          setWaiting(false);
        } else if (msg.type === "status") {
          onStatusChange?.(msg.status);
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      fetch(`/api/tasks/${taskId}/logs`)
        .then((r) => r.json())
        .then((data: LogEntry[]) => {
          if (Array.isArray(data) && data.length > 0) {
            setLines(data.map((e) => `${e.timestamp} ${e.message}`));
            setWaiting(false);
          }
        })
        .catch(() => {});
    };

    return () => {
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
    };
  }, [taskId, onStatusChange]);

  useEffect(() => {
    const el = logBodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  const lineColor = (line: string) => {
    if (/error|fail|exception/i.test(line)) return "text-red-400";
    if (/warn/i.test(line)) return "text-yellow-400";
    return "text-zinc-400";
  };

  const lineBorder = (line: string) => {
    if (/error|fail|exception/i.test(line)) return "border-l-red-500/60";
    if (/warn/i.test(line)) return "border-l-yellow-500/60";
    return "border-l-transparent";
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border overflow-hidden",
        TERMINAL_BG,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 border-b border-border",
          TERMINAL_HEADER_BG,
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[11px] text-zinc-400 font-mono">
          LIVE — {taskId}
        </span>
        <span className="text-[10px] text-zinc-600 ml-auto font-mono">
          {lines.length} lines
        </span>
      </div>
      <div
        ref={logBodyRef}
        className="overflow-y-auto max-h-[500px] p-0 font-mono text-[11px] leading-[1.7]"
      >
        {waiting ? (
          <div className="text-zinc-600 text-center py-12 flex flex-col items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>로그 대기 중...</span>
          </div>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "px-3 py-0.5 hover:bg-white/[0.03] border-l-2 transition-colors",
                i === lines.length - 1
                  ? "border-l-emerald-500/60 bg-emerald-500/[0.04]"
                  : lineBorder(line),
                lineColor(line),
              )}
            >
              <span className="text-zinc-600 select-none mr-3 inline-block w-5 text-right">
                {i + 1}
              </span>
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
