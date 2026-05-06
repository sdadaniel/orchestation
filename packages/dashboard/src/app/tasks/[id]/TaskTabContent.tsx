"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useMemo, useState, useEffect, useRef } from "react";
import { Copy, Terminal } from "lucide-react";
import { useTaskLogStream } from "@/gateway-ws/task-streams";
import { LiveTerminalPanel } from "@/components/TaskDetail/LiveTerminalPanel";
import { Tabs } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { TERMINAL_BG, TERMINAL_HEADER_BG } from "@/constants/theme";
import { TaskDetail } from "./types";

/* ── Detail Tab ── */

interface DetailTabProps {
  task: TaskDetail;
}

/**
 * Markdown headings (e.g. "## Completion Criteria") should match the Description label.
 * `prose-custom` sets its own heading sizes, so we use `!` utilities to ensure parity.
 */
const detailMarkdownSectionHeading =
  "[&_h1]:!text-xs [&_h1]:!font-semibold [&_h1]:!uppercase [&_h1]:!tracking-wider [&_h1]:!text-muted-foreground [&_h1]:!mt-5 [&_h1]:!mb-2 [&_h1]:!border-0 [&_h1]:!pb-0 " +
  "[&_h2]:!text-xs [&_h2]:!font-semibold [&_h2]:!uppercase [&_h2]:!tracking-wider [&_h2]:!text-muted-foreground [&_h2]:!mt-5 [&_h2]:!mb-2 [&_h2]:!border-0 [&_h2]:!pb-0 " +
  "[&_h3]:!text-xs [&_h3]:!font-semibold [&_h3]:!uppercase [&_h3]:!tracking-wider [&_h3]:!text-muted-foreground [&_h3]:!mt-5 [&_h3]:!mb-2 [&_h3]:!border-0 [&_h3]:!pb-0";

export function DetailTab({ task }: DetailTabProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Description
        </h2>
        {task.content ? (
          <MarkdownContent className={detailMarkdownSectionHeading}>
            {task.content}
          </MarkdownContent>
        ) : (
          <p className="text-sm text-muted-foreground">(No description)</p>
        )}
      </div>
    </div>
  );
}

/* ── Scope Tab ── */

interface ScopeTabProps {
  scope: string[];
}

export function ScopeTab({ scope }: ScopeTabProps) {
  return (
    <div>
      {scope?.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {scope.map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Scope가 지정되지 않았습니다.
        </p>
      )}
    </div>
  );
}

/* ── AI Result Tab ── */

interface AiResultTabProps {
  aiResult: {
    status: string;
    result: string;
    reviewFeedback?: string | null;
  } | null;
  aiResultLoading: boolean;
  taskStatus: string;
}

export function AiResultTab({
  aiResult,
  aiResultLoading,
  taskStatus,
}: AiResultTabProps) {
  if (taskStatus === "stopped") {
    return (
      <p className="text-sm text-muted-foreground">태스크가 중지되었습니다.</p>
    );
  }

  if (taskStatus === "in_progress") {
    return (
      <p className="text-sm text-muted-foreground">
        태스크 실행 중입니다. 완료 후 결과가 표시됩니다.
      </p>
    );
  }

  if (aiResultLoading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!aiResult) {
    return (
      <p className="text-sm text-muted-foreground">아직 AI 결과가 없습니다.</p>
    );
  }

  const isReviewFailed =
    taskStatus === "failed" && aiResult.status !== "rejected";
  const statusLabel =
    aiResult.status === "rejected"
      ? "REJECTED"
      : isReviewFailed
        ? "REVIEW FAILED"
        : "DONE";
  const statusColor =
    aiResult.status === "rejected" || isReviewFailed
      ? "text-red-500"
      : "text-emerald-500";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Status:</span>
        <span className={cn("text-xs font-semibold", statusColor)}>
          {statusLabel}
        </span>
      </div>

      {isReviewFailed && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
          <p className="text-xs font-medium text-red-400">
            리뷰 단계에서 실패했습니다. 워커 작업은 완료되었으나 리뷰를 통과하지
            못했습니다.
          </p>
          {aiResult.reviewFeedback && (
            <div className="text-xs text-muted-foreground border-t border-red-500/20 pt-2 mt-2">
              <p className="text-[10px] font-medium text-red-400/70 mb-1">
                리뷰 피드백:
              </p>
              <MarkdownContent>{aiResult.reviewFeedback}</MarkdownContent>
            </div>
          )}
        </div>
      )}

      {aiResult.result && (
        <div>
          {isReviewFailed && (
            <p className="text-[10px] text-muted-foreground mb-1">
              워커 작업 결과:
            </p>
          )}
          <MarkdownContent>{aiResult.result}</MarkdownContent>
        </div>
      )}
    </div>
  );
}

/* ── Cost Tab ── */

interface CostTabProps {
  task: TaskDetail;
}

export function CostTab({ task }: CostTabProps) {
  if (task.costEntries && task.costEntries.length > 0) {
    return (
      <div>
        <div className="space-y-1">
          {task.costEntries.map((entry, i) => (
            <div key={i} className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground w-16 shrink-0 capitalize">
                {entry.phase}
              </span>
              <span className="font-mono w-16 shrink-0">{entry.cost}</span>
              <span className="text-muted-foreground w-16 shrink-0">
                {entry.duration}
              </span>
              <span className="text-muted-foreground font-mono">
                {entry.tokens}
              </span>
            </div>
          ))}
          <div className="border-t border-border pt-1 mt-1 flex items-center gap-3 text-xs font-medium">
            <span className="w-16 shrink-0">Total</span>
            <span className="font-mono w-16 shrink-0">
              $
              {task.costEntries
                .reduce(
                  (sum, e) =>
                    sum + parseFloat((e.cost ?? "0").replace("$", "")),
                  0,
                )
                .toFixed(4)}
            </span>
            <span className="text-muted-foreground w-16 shrink-0">
              {task.costEntries
                .reduce((sum, e) => sum + parseFloat(e.duration || "0"), 0)
                .toFixed(1)}
              s
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-12 text-sm text-muted-foreground">
      {task.status === "in_progress"
        ? "태스크 완료 후 비용 정보가 표시됩니다."
        : "비용 정보가 없습니다."}
    </div>
  );
}

/* ── Logs Tab ── */

interface LogsTabProps {
  taskId: string;
  runStatus: "idle" | "running" | "completed" | "failed";
  taskStatus: string;
  hasExecutionLog: boolean;
  onStatusChange: (status: string) => Promise<void>;
  logView?: string | null;
  onLogViewChange?: (view: string) => void;
}

export function LogsTab({
  taskId,
  taskStatus,
  onStatusChange,
  logView,
  onLogViewChange,
}: LogsTabProps) {
  type LogViewKey = "all" | "conversation" | "events" | "costs" | "terminal";
  const initialView: LogViewKey =
    logView === "terminal" ||
    logView === "conversation" ||
    logView === "events" ||
    logView === "costs"
      ? (logView as LogViewKey)
      : "all";

  const [activeView, setActiveView] = useState<LogViewKey>(initialView);
  useEffect(() => {
    setActiveView(initialView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logView]);

  const setView = (view: LogViewKey) => {
    setActiveView(view);
    onLogViewChange?.(view);
  };

  const { lines, loaded, error } = useTaskLogStream(taskId, onStatusChange);
  const waiting = !loaded;

  const logBodyRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);

  const classify = (line: string): Exclude<LogViewKey, "all" | "terminal"> => {
    const rest = line.replace(
      /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\s+/,
      "",
    );
    if (
      /phase=\w+\s*\|\s*turns=\d+\s*\|\s*duration=\d+ms\s*\|\s*cost=\$/.test(
        rest,
      )
    )
      return "costs";
    if (rest.startsWith("[")) return "events";
    return "conversation";
  };

  const filtered = useMemo(() => {
    if (activeView === "all") return lines;
    if (activeView === "terminal") return [];
    return lines.filter((line) => classify(line) === activeView);
  }, [activeView, lines]);

  const counts = useMemo(() => {
    const c = { all: lines.length, conversation: 0, events: 0, costs: 0 };
    for (const line of lines) {
      const kind = classify(line);
      c[kind] += 1;
    }
    return c;
  }, [lines]);

  useEffect(() => {
    const el = logBodyRef.current;
    // 최신 로그가 위에 오도록 렌더링하므로, 새 로그가 오면 상단을 유지
    if (el && activeView !== "terminal") el.scrollTop = 0;
  }, [filtered.length, activeView]);

  const lineColor = (line: string) => {
    if (/error|fail|exception|rejected/i.test(line)) return "text-red-400";
    if (/warn/i.test(line)) return "text-yellow-400";
    return "text-zinc-400";
  };

  const lineBorder = (line: string) => {
    if (/error|fail|exception|rejected/i.test(line)) return "border-l-red-500/60";
    if (/warn/i.test(line)) return "border-l-yellow-500/60";
    return "border-l-transparent";
  };

  const copyAll = async () => {
    const text =
      activeView === "terminal"
        ? ""
        : [...filtered].reverse().join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-3">
      <Tabs<LogViewKey>
        activeKey={activeView}
        onChange={setView}
        items={[
          { key: "all", label: `전체 (${counts.all})`, icon: Terminal },
          { key: "conversation", label: `대화 (${counts.conversation})` },
          { key: "events", label: `이벤트 (${counts.events})` },
          { key: "costs", label: `비용 (${counts.costs})` },
          { key: "terminal", label: "Terminal" },
        ]}
      />

      {activeView === "terminal" ? (
        <LiveTerminalPanel taskId={taskId} />
      ) : (
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
              <span
                className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  taskStatus === "in_progress" ? "bg-emerald-500" : "bg-zinc-500",
                )}
              />
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">
              LOGS — {taskId}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-zinc-400 hover:text-zinc-200"
                onClick={copyAll}
                aria-label="Copy logs"
                title="Copy logs"
                disabled={filtered.length === 0}
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </Button>
              <span className="text-[10px] text-zinc-600 font-mono">
                {filtered.length} lines
              </span>
            </div>
          </div>
          <div
            ref={logBodyRef}
            className="overflow-y-auto min-h-[500px] max-h-[500px] p-0 font-mono text-[11px] leading-[1.7] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {waiting ? (
              <div className="text-zinc-600 text-center py-12 flex flex-col items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>로그 불러오는 중...</span>
              </div>
            ) : error ? (
              <div className="text-red-400 text-center py-10 text-xs px-3">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-10">
                해당 분류의 로그가 없습니다.
              </p>
            ) : (
              [...filtered].reverse().map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    "px-3 py-0.5 hover:bg-white/[0.03] border-l-2 transition-colors",
                    i === 0 && taskStatus === "in_progress"
                      ? "border-l-emerald-500/60 bg-emerald-500/[0.04]"
                      : lineBorder(line),
                    lineColor(line),
                  )}
                >
                  <span className="text-zinc-600 select-none mr-3 inline-block w-5 text-right">
                    {filtered.length - i}
                  </span>
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
