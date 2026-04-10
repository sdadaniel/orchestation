"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TERMINAL_BG, TERMINAL_HEADER_BG } from "@/constants/terminal";

interface TerminalEntry {
  type: "tool_use" | "tool_result" | "thinking" | "text" | "system";
  name?: string;
  detail?: string;
  timestamp?: string;
}

function parseJSONLLine(raw: string): TerminalEntry | null {
  try {
    const obj = JSON.parse(raw);

    if (obj.type === "system") {
      return { type: "system", detail: obj.subtype || "init" };
    }

    if (obj.type === "assistant" && obj.message?.content) {
      for (const block of obj.message.content) {
        if (block.type === "tool_use") {
          const name = block.name || "unknown";
          let detail = "";
          const input = block.input || {};
          if (name === "Read" || name === "Write")
            detail = input.file_path || "";
          else if (name === "Edit") detail = input.file_path || "";
          else if (name === "Bash")
            detail = (input.command || "").slice(0, 120);
          else if (name === "Grep")
            detail = `${input.pattern || ""} ${input.path || ""}`;
          else if (name === "Glob") detail = input.pattern || "";
          else if (name === "Agent") detail = input.description || "";
          else detail = JSON.stringify(input).slice(0, 100);
          return { type: "tool_use", name, detail };
        }
        if (block.type === "thinking") {
          const text = (block.thinking || "").slice(0, 150);
          return { type: "thinking", detail: text };
        }
        if (block.type === "text") {
          const text = (block.text || "").slice(0, 200);
          return { type: "text", detail: text };
        }
      }
    }

    if (obj.type === "result") {
      return { type: "system", detail: "━━━ Claude 작업 완료 ━━━" };
    }

    return null;
  } catch {
    return null;
  }
}

const TOOL_ICONS: Record<string, string> = {
  Read: "📖",
  Write: "✏️",
  Edit: "🔧",
  Bash: "💻",
  Grep: "🔍",
  Glob: "📂",
  Agent: "🤖",
};

export function LiveTerminalPanel({ taskId }: { taskId: string }) {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [waiting, setWaiting] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/task-terminal/${taskId}`,
    );

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "jsonl" && msg.line) {
          const entry = parseJSONLLine(msg.line);
          if (entry) {
            setEntries((prev) => [...prev, entry]);
            setWaiting(false);
          }
        } else if (msg.type === "batch" && Array.isArray(msg.lines)) {
          const parsed = msg.lines
            .map(parseJSONLLine)
            .filter(Boolean) as TerminalEntry[];
          if (parsed.length > 0) {
            setEntries((prev) => [...prev, ...parsed]);
            setWaiting(false);
          }
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      // Fallback: fetch completed conversation JSONL
      fetch(`/api/tasks/${taskId}/conversation`)
        .then((r) => r.json())
        .then((data: string[]) => {
          const parsed = data
            .map(parseJSONLLine)
            .filter(Boolean) as TerminalEntry[];
          if (parsed.length > 0) {
            setEntries(parsed);
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
  }, [taskId]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  const entryStyle = (entry: TerminalEntry) => {
    switch (entry.type) {
      case "tool_use":
        return "text-cyan-400";
      case "tool_result":
        return "text-zinc-500";
      case "thinking":
        return "text-violet-400/70 italic";
      case "text":
        return "text-zinc-300";
      case "system":
        return "text-zinc-600";
      default:
        return "text-zinc-400";
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
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
        </span>
        <span className="text-[11px] text-zinc-400 font-mono">
          TERMINAL — {taskId}
        </span>
        <span className="text-[10px] text-zinc-600 ml-auto font-mono">
          {entries.length} events
        </span>
      </div>
      <div
        ref={bodyRef}
        className="overflow-y-auto max-h-[500px] p-0 font-mono text-[11px] leading-[1.7]"
      >
        {waiting ? (
          <div className="text-zinc-600 text-center py-12 flex flex-col items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>터미널 로그 대기 중...</span>
          </div>
        ) : (
          entries.map((entry, i) => (
            <div
              key={i}
              className={cn(
                "px-3 py-0.5 hover:bg-white/[0.03] border-l-2 transition-colors",
                entry.type === "tool_use"
                  ? "border-l-cyan-500/60"
                  : "border-l-transparent",
                entryStyle(entry),
              )}
            >
              <span className="text-zinc-600 select-none mr-3 inline-block w-5 text-right">
                {i + 1}
              </span>
              {entry.type === "tool_use" && (
                <>
                  <span className="mr-1">
                    {TOOL_ICONS[entry.name || ""] || "⚙️"}
                  </span>
                  <span className="text-cyan-300 font-semibold mr-2">
                    {entry.name}
                  </span>
                  <span className="text-zinc-500">{entry.detail}</span>
                </>
              )}
              {entry.type === "thinking" && (
                <span className="text-violet-400/70">💭 {entry.detail}...</span>
              )}
              {entry.type === "text" && <span>{entry.detail}</span>}
              {entry.type === "system" && (
                <span className="text-zinc-600">{entry.detail}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
