"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TERMINAL_BG, TERMINAL_HEADER_BG } from "@/constants/terminal";

export function CompletedLogPanel({ taskId }: { taskId: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}/logs`)
      .then((r) => r.json())
      .then((data: { line?: string; message?: string }[]) => {
        if (Array.isArray(data)) {
          setLines(data.map((d) => d.line || d.message || "").filter(Boolean));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [taskId]);

  const lineColor = (line: string) => {
    if (/error|fail|exception|❌/i.test(line)) return "text-red-400";
    if (/warn|⚠️/i.test(line)) return "text-yellow-400";
    if (/🔧|Edit|Write/i.test(line)) return "text-blue-400";
    if (/✅|완료|success/i.test(line)) return "text-emerald-400";
    return "text-zinc-400";
  };

  if (loading) {
    return (
      <div className="text-zinc-600 text-center py-8 flex flex-col items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">로그 불러오는 중...</span>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">실행 로그가 없습니다.</p>
    );
  }

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
        <span className="inline-flex rounded-full h-2 w-2 bg-zinc-500" />
        <span className="text-[11px] text-zinc-400 font-mono">
          LOG — {taskId}
        </span>
        <span className="text-[10px] text-zinc-600 ml-auto font-mono">
          {lines.length} lines
        </span>
      </div>
      <div className="overflow-y-auto max-h-[500px] p-0 font-mono text-[11px] leading-[1.7] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[...lines].reverse().map((line, i) => (
          <div
            key={i}
            className={cn(
              "px-3 py-0.5 hover:bg-white/[0.03] border-l-2 border-l-transparent transition-colors",
              lineColor(line),
            )}
          >
            <span className="text-zinc-600 select-none mr-3 inline-block w-5 text-right">
              {lines.length - i}
            </span>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
