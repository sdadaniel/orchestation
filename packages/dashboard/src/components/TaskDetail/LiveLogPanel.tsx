"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TERMINAL_BG, TERMINAL_HEADER_BG } from "@/constants/theme";
import { useTaskLogStream } from "@/gateway-ws/task-streams";
import { Button } from "@/components/ui/button";

export function LiveLogPanel({
  taskId,
  onStatusChange,
}: {
  taskId: string;
  onStatusChange?: (status: string) => void;
}) {
  const { lines, loaded } = useTaskLogStream(taskId, onStatusChange);
  const waiting = !loaded || lines.length === 0;
  const logBodyRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = logBodyRef.current;
    // 최신 로그가 위에 오도록 렌더링하므로, 새 로그가 오면 상단을 유지
    if (el) el.scrollTop = 0;
  }, [lines.length]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);

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

  const copyAll = async () => {
    const text = [...lines].reverse().join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // ignore
    }
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
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-zinc-400 hover:text-zinc-200"
            onClick={copyAll}
            aria-label="Copy all logs"
            title="Copy all logs"
            disabled={lines.length === 0}
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </Button>
          <span className="text-[10px] text-zinc-600 font-mono">
            {lines.length} lines
          </span>
        </div>
      </div>
      <div
        ref={logBodyRef}
        className="overflow-y-auto max-h-[500px] p-0 font-mono text-[11px] leading-[1.7] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {waiting ? (
          <div className="text-zinc-600 text-center py-12 flex flex-col items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>로그 대기 중...</span>
          </div>
        ) : (
          [...lines].reverse().map((line, i) => (
            <div
              key={i}
              className={cn(
                "px-3 py-0.5 hover:bg-white/[0.03] border-l-2 transition-colors",
                i === 0
                  ? "border-l-emerald-500/60 bg-emerald-500/[0.04]"
                  : lineBorder(line),
                lineColor(line),
              )}
            >
              <span className="text-zinc-600 select-none mr-3 inline-block w-5 text-right">
                {lines.length - i}
              </span>
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
