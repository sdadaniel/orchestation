"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, FileText, Terminal, ClipboardCheck, Play, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CostEntry {
  phase: string;
  cost: string;
  duration: string;
  tokens: string;
}

interface DepRef {
  id: string;
  title: string;
  status: string;
}

interface TaskDetail {
  id: string;
  title: string;
  status: string;
  priority: string;
  created: string;
  content: string;
  depends_on_detail: DepRef[];
  depended_by: DepRef[];
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

const displayTaskId = (id: string) => id;

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

function LiveLogPanel({ taskId }: { taskId: string }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (!alive) return;
      try {
        const res = await fetch(`/api/tasks/${taskId}/logs`);
        if (!res.ok) return;
        const data: LogEntry[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setEntries(data.reverse());
          setWaiting(false);
        }
      } catch {
        // ignore
      }
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => { alive = false; clearInterval(id); };
  }, [taskId]);

  const levelColor = (level: string) => {
    if (level === "error") return "text-red-400";
    if (level === "warn") return "text-yellow-400";
    return "text-zinc-400";
  };

  const levelBorder = (level: string) => {
    if (level === "error") return "border-l-red-500/60";
    if (level === "warn") return "border-l-yellow-500/60";
    return "border-l-transparent";
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-[#0d1117]">
      {/* header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#161b22] border-b border-border">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[11px] text-zinc-400 font-mono">LIVE — {taskId}</span>
        <span className="text-[10px] text-zinc-600 ml-auto font-mono">{entries.length} lines</span>
      </div>
      {/* log body */}
      <div className="overflow-y-auto max-h-[500px] p-0 font-mono text-[11px] leading-[1.7]">
        {waiting ? (
          <div className="text-zinc-600 text-center py-12 flex flex-col items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>로그 대기 중...</span>
          </div>
        ) : (
          entries.map((entry, i) => (
            <div
              key={i}
              className={cn(
                "px-3 py-0.5 hover:bg-white/[0.03] border-l-2 transition-colors",
                i === 0 ? "border-l-emerald-500/60 bg-emerald-500/[0.04]" : levelBorder(entry.level),
                levelColor(entry.level),
              )}
            >
              <span className="text-zinc-600 select-none mr-3 inline-block w-5 text-right">{entries.length - i}</span>
              <span className="text-zinc-600 mr-2">{entry.timestamp}</span>
              {entry.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"detail" | "execution" | "review" | "logs">("detail");
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [runLogs, setRunLogs] = useState<string[]>([]);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);

  useEffect(() => {
    async function fetchTask() {
      try {
        const res = await fetch(`/api/requests/${id}`);
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
  }, [id]);

  // Check orchestration status
  useEffect(() => {
    async function checkOrchestration() {
      try {
        const res = await fetch("/api/orchestrate/status");
        const data = await res.json();
        setIsPipelineRunning(data.status === "running");
      } catch {
        // ignore
      }
    }
    checkOrchestration();
    const interval = setInterval(checkOrchestration, 5000);
    return () => clearInterval(interval);
  }, []);

  // Check if task is already running on page load
  useEffect(() => {
    async function checkRunStatus() {
      try {
        const res = await fetch(`/api/tasks/${id}/run`);
        const data = await res.json();
        if (data.status === "running") {
          setRunStatus("running");
          setRunLogs(data.logs || []);
        } else if (data.status === "completed" || data.status === "failed") {
          setRunStatus(data.status);
          setRunLogs(data.logs || []);
        }
      } catch {
        // ignore
      }
    }
    checkRunStatus();
  }, [id]);

  // Poll task run status while running
  useEffect(() => {
    if (runStatus !== "running") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks/${id}/run`);
        const data = await res.json();
        setRunLogs(data.logs || []);
        if (data.status !== "running") {
          setRunStatus(data.status);
          // Refresh task data after completion
          const taskRes = await fetch(`/api/requests/${id}`);
          if (taskRes.ok) setTask(await taskRes.json());
        }
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [runStatus, id]);

  const handleRun = async () => {
    try {
      const res = await fetch(`/api/tasks/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "실행 실패");
        return;
      }
      setRunStatus("running");
      setRunLogs([]);
    } catch {
      alert("실행 요청 실패");
    }
  };

  const handleStop = async () => {
    try {
      await fetch(`/api/tasks/${id}/run`, { method: "DELETE" });
    } catch {
      // ignore
    }
  };

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

        {/* Run / Stop button */}
        <div className="ml-auto">
          {runStatus === "running" || task.status === "in_progress" ? (
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              <Square className="h-3 w-3" />
              중지
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRun}
              disabled={isPipelineRunning || task.status === "in_progress"}
              title={
                isPipelineRunning
                  ? "파이프라인 실행 중에는 개별 실행 불가"
                  : task.status === "in_progress"
                    ? "이미 실행 중인 태스크입니다"
                    : `${displayTaskId(task.id)} 실행`
              }
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors",
                isPipelineRunning || task.status === "in_progress"
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white",
              )}
            >
              <Play className="h-3 w-3" />
              실행
            </button>
          )}
        </div>
      </div>

      {/* Run status banner */}
      {runStatus === "running" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          태스크 실행 중...
          {runLogs.length > 0 && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              {runLogs.length} lines
            </span>
          )}
        </div>
      )}
      {runStatus === "completed" && (
        <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
          실행 완료
        </div>
      )}
      {runStatus === "failed" && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          실행 실패
        </div>
      )}

      {/* Dependency Flow — 탭 위 고정 */}
      {(task.depends_on_detail?.length > 0 || task.depended_by?.length > 0) && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Dependency Flow
          </h2>
          <div className="flex items-center gap-0 overflow-x-auto pb-1">
            {task.depends_on_detail?.map((dep) => (
              <div key={dep.id} className="flex items-center gap-0 shrink-0">
                <button
                  type="button"
                  onClick={() => router.push(`/tasks/${dep.id}`)}
                  className="flex flex-col gap-1 px-3 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors min-w-[140px]"
                >
                  <div className="flex items-center gap-1.5">
                    {dep.status === "in_progress" ? (
                      <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[dep.status] || "bg-gray-400")} />
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground">{dep.id}</span>
                  </div>
                  <span className="text-[11px] leading-tight line-clamp-2">{dep.title}</span>
                </button>
                <span className="text-muted-foreground mx-1.5 text-sm shrink-0">&rarr;</span>
              </div>
            ))}
            <div className="flex flex-col gap-1 px-3 py-2 rounded-lg border-2 border-primary bg-primary/5 min-w-[140px] shrink-0">
              <div className="flex items-center gap-1.5">
                {task.status === "in_progress" ? (
                  <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[task.status] || "bg-gray-400")} />
                )}
                <span className="font-mono text-[10px] font-semibold">{task.id}</span>
              </div>
              <span className="text-[11px] leading-tight font-medium line-clamp-2">{task.title}</span>
            </div>
            {task.depended_by?.map((dep) => (
              <div key={dep.id} className="flex items-center gap-0 shrink-0">
                <span className="text-muted-foreground mx-1.5 text-sm shrink-0">&rarr;</span>
                <button
                  type="button"
                  onClick={() => router.push(`/tasks/${dep.id}`)}
                  className="flex flex-col gap-1 px-3 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors min-w-[140px]"
                >
                  <div className="flex items-center gap-1.5">
                    {dep.status === "in_progress" ? (
                      <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[dep.status] || "bg-gray-400")} />
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground">{dep.id}</span>
                  </div>
                  <span className="text-[11px] leading-tight line-clamp-2">{dep.title}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
        {([
          { key: "detail" as const, label: "상세", icon: FileText },
          { key: "logs" as const, label: "로그", icon: Terminal },
          { key: "review" as const, label: "리뷰 결과", icon: ClipboardCheck },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "detail" && (
        <>
          {/* Content */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Description
            </h2>
            <div className="text-sm text-foreground prose prose-invert prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded">
              {task.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.content}</ReactMarkdown>
              ) : "(No description)"}
            </div>
          </div>

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
        </>
      )}

      {/* logs 탭은 아래에서 통합 렌더링 */}

      {activeTab === "review" && (
        task.reviewResult ? (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="text-xs space-y-1">
              {task.reviewResult.subtype && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Result:</span>
                  <span className={cn(
                    "font-medium",
                    task.reviewResult.subtype === "success" ? "text-emerald-500" : "text-red-500",
                  )}>
                    {task.reviewResult.subtype === "success" ? "Approved" : String(task.reviewResult.subtype)}
                  </span>
                </div>
              )}
            </div>
            {task.reviewResult.result && (
              <div className="p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
                {String(task.reviewResult.result)}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            아직 리뷰 결과가 없습니다.
          </div>
        )
      )}

      {activeTab === "logs" && (
        task.status === "in_progress" ? (
          <LiveLogPanel taskId={id} />
        ) : task.executionLog ? (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
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
              {task.executionLog.duration_ms !== undefined && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Duration:</span>
                  <span>{(Number(task.executionLog.duration_ms) / 1000).toFixed(1)}s</span>
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
              <div className="p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
                {String(task.executionLog.result)}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            아직 실행 로그가 없습니다.
          </div>
        )
      )}
    </div>
  );
}
