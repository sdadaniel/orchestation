"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { LiveLogPanel } from "@/components/task-detail/LiveLogPanel";
import { CompletedLogPanel } from "@/components/task-detail/CompletedLogPanel";
import { TaskDetail } from "./types";

/* ── Detail Tab ── */

interface DetailTabProps {
  task: TaskDetail;
}

export function DetailTab({ task }: DetailTabProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Description
        </h2>
        {task.content ? (
          <MarkdownContent>{task.content}</MarkdownContent>
        ) : <p className="text-sm text-muted-foreground">(No description)</p>}
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
            <span key={i} className="inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">{s}</span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Scope가 지정되지 않았습니다.</p>
      )}
    </div>
  );
}

/* ── AI Result Tab ── */

interface AiResultTabProps {
  aiResult: { status: string; result: string } | null;
  aiResultLoading: boolean;
  taskStatus: string;
}

export function AiResultTab({ aiResult, aiResultLoading, taskStatus }: AiResultTabProps) {
  if (taskStatus === "stopped") {
    return <p className="text-sm text-muted-foreground">태스크가 중지되었습니다.</p>;
  }

  if (taskStatus === "in_progress") {
    return <p className="text-sm text-muted-foreground">태스크 실행 중입니다. 완료 후 결과가 표시됩니다.</p>;
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
    return <p className="text-sm text-muted-foreground">아직 AI 결과가 없습니다.</p>;
  }

  const statusLabel = aiResult.status === "rejected" ? "REJECTED" : "DONE";
  const statusColor = aiResult.status === "rejected" ? "text-red-500" : "text-emerald-500";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Status:</span>
        <span className={cn("text-xs font-semibold", statusColor)}>{statusLabel}</span>
      </div>
      {aiResult.result && (
        <MarkdownContent>{aiResult.result}</MarkdownContent>
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
              <span className="text-muted-foreground w-16 shrink-0 capitalize">{entry.phase}</span>
              <span className="font-mono w-16 shrink-0">{entry.cost}</span>
              <span className="text-muted-foreground w-16 shrink-0">{entry.duration}</span>
              <span className="text-muted-foreground font-mono">{entry.tokens}</span>
            </div>
          ))}
          <div className="border-t border-border pt-1 mt-1 flex items-center gap-3 text-xs font-medium">
            <span className="w-16 shrink-0">Total</span>
            <span className="font-mono w-16 shrink-0">
              ${task.costEntries.reduce((sum, e) => sum + parseFloat((e.cost ?? "0").replace("$", "")), 0).toFixed(4)}
            </span>
            <span className="text-muted-foreground w-16 shrink-0">
              {task.costEntries.reduce((sum, e) => sum + parseFloat(e.duration || "0"), 0).toFixed(1)}s
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-12 text-sm text-muted-foreground">
      {task.status === "in_progress" ? "태스크 완료 후 비용 정보가 표시됩니다." : "비용 정보가 없습니다."}
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
}

export function LogsTab({ taskId, runStatus, taskStatus, hasExecutionLog, onStatusChange }: LogsTabProps) {
  if (runStatus === "running" || taskStatus === "in_progress") {
    return <LiveLogPanel taskId={taskId} onStatusChange={onStatusChange} />;
  }

  if (hasExecutionLog) {
    return <CompletedLogPanel taskId={taskId} />;
  }

  return <p className="text-sm text-muted-foreground">아직 실행 로그가 없습니다.</p>;
}
