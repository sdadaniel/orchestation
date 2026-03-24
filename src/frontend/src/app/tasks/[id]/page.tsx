"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, ChevronDown, ChevronRight } from "lucide-react";

interface CostEntry {
  phase: string;
  cost: string;
  duration: string;
  tokens: string;
}

interface TaskDetail {
  id: string;
  title: string;
  status: string;
  priority: string;
  created: string;
  content: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executionLog: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reviewResult: Record<string, any> | null;
  costEntries: CostEntry[];
}

const STATUS_DOT: Record<string, string> = {
  pending: "bg-yellow-500",
  in_progress: "bg-blue-500",
  reviewing: "bg-orange-500",
  done: "bg-emerald-500",
  rejected: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  reviewing: "Reviewing",
  done: "Done",
  rejected: "Rejected",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-500 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  low: "bg-green-500/15 text-green-500 border-green-500/30",
};

const displayTaskId = (id: string) => id.replace(/^REQ-/, "TASK-");

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExecLog, setShowExecLog] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // The id from URL is TASK-XXX format, convert to REQ-XXX for API
  const reqId = id.replace(/^TASK-/, "REQ-");

  useEffect(() => {
    async function fetchTask() {
      try {
        const res = await fetch(`/api/requests/${reqId}`);
        if (!res.ok) throw new Error("Task not found");
        const data = await res.json();
        setTask(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load task");
      } finally {
        setIsLoading(false);
      }
    }
    fetchTask();
  }, [reqId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.push("/tasks")}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-sm text-red-500">{error || "Task not found"}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/tasks")}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="font-mono text-xs text-muted-foreground">{displayTaskId(task.id)}</span>
        <h1 className="text-lg font-semibold flex-1">{task.title}</h1>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {task.status === "in_progress" ? (
            <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[task.status])} />
          )}
          <span className="text-xs font-medium">{STATUS_LABEL[task.status] || task.status}</span>
        </div>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", PRIORITY_COLORS[task.priority])}>
          {task.priority}
        </span>
        <span className="text-[11px] text-muted-foreground">
          Created: {task.created}
        </span>
      </div>

      {/* Content */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Description
        </h2>
        <div className="text-sm whitespace-pre-wrap text-foreground">
          {task.content || "(No description)"}
        </div>
      </div>

      {/* Execution Log */}
      {task.executionLog && (
        <div className="rounded-lg border border-border bg-card">
          <button
            type="button"
            onClick={() => setShowExecLog(!showExecLog)}
            className="w-full flex items-center gap-2 p-4 text-left"
          >
            {showExecLog ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Execution Log
            </h2>
            <span className="text-[10px] text-muted-foreground">
              {task.executionLog.duration_ms
                ? `${(Number(task.executionLog.duration_ms) / 1000).toFixed(1)}s`
                : ""}
            </span>
          </button>
          {showExecLog && (
            <div className="px-4 pb-4">
              <div className="text-xs space-y-1">
                {task.executionLog.subtype && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">Result:</span>
                    <span className={cn(
                      "font-medium",
                      task.executionLog.subtype === "success" ? "text-emerald-500" : "text-red-500",
                    )}>
                      {String(task.executionLog.subtype)}
                    </span>
                  </div>
                )}
                {task.executionLog.num_turns !== undefined && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">Turns:</span>
                    <span>{String(task.executionLog.num_turns)}</span>
                  </div>
                )}
                {task.executionLog.total_cost_usd !== undefined && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">Cost:</span>
                    <span>${Number(task.executionLog.total_cost_usd).toFixed(4)}</span>
                  </div>
                )}
              </div>
              {task.executionLog.result && (
                <div className="mt-3 p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {String(task.executionLog.result)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Review Result */}
      {task.reviewResult && (
        <div className="rounded-lg border border-border bg-card">
          <button
            type="button"
            onClick={() => setShowReview(!showReview)}
            className="w-full flex items-center gap-2 p-4 text-left"
          >
            {showReview ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Review Result
            </h2>
            <span className="text-[10px] text-muted-foreground">
              {task.reviewResult.subtype === "success" ? "Approved" : String(task.reviewResult.subtype || "")}
            </span>
          </button>
          {showReview && (
            <div className="px-4 pb-4">
              {task.reviewResult.result && (
                <div className="p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {String(task.reviewResult.result)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cost Info */}
      {task.costEntries.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Cost
          </h2>
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
                ${task.costEntries.reduce((sum, e) => sum + parseFloat(e.cost.replace("$", "")), 0).toFixed(4)}
              </span>
              <span className="text-muted-foreground w-16 shrink-0">
                {task.costEntries.reduce((sum, e) => sum + parseFloat(e.duration), 0).toFixed(1)}s
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
