"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, FileText, Terminal, ClipboardCheck, Play, Square, CheckCircle2, GitBranch, Check, DollarSign, Trash2 } from "lucide-react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { HorseRunningIndicator } from "@/components/HorseRunningIndicator";

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

interface ExecutionLog {
  subtype?: string;
  num_turns?: number;
  duration_ms?: number;
  total_cost_usd?: number;
  result?: string;
}

interface ReviewResult {
  subtype?: string;
  result?: string;
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
  executionLog: ExecutionLog | null;
  reviewResult: ReviewResult | null;
  costEntries: CostEntry[];
  scope: string[];
  branch: string;
}

const STATUS_DOT: Record<string, string> = {
  stopped: "bg-violet-500",
  pending: "bg-yellow-500",
  in_progress: "bg-blue-500",
  reviewing: "bg-orange-500",
  done: "bg-emerald-500",
  rejected: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  stopped: "Stopped",
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
          setEntries([...data].reverse());
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

function BranchBadge({ branch }: { branch: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(branch); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono max-w-[240px] truncate hover:text-foreground transition-colors cursor-pointer"
      title="클릭하여 복사"
    >
      {copied ? <Check className="h-3 w-3 shrink-0 text-emerald-400" /> : <GitBranch className="h-3 w-3 shrink-0" />}
      <span className="truncate">{branch}</span>
      {copied && <span className="text-emerald-400 text-[9px] ml-0.5">copied</span>}
    </button>
  );
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"detail" | "scope" | "cost" | "ai-result" | "review" | "logs">("detail");
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiResultLoading, setAiResultLoading] = useState(false);
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

  // Lazy-load AI result
  useEffect(() => {
    if (activeTab === "ai-result" && aiResult === null && !aiResultLoading) {
      setAiResultLoading(true);
      fetch(`/api/tasks/${id}/result`)
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then((data) => setAiResult(data.result ?? ""))
        .catch(() => setAiResult(""))
        .finally(() => setAiResultLoading(false));
    }
  }, [activeTab, aiResult, aiResultLoading, id]);

  // Check orchestration status
  useEffect(() => {
    async function checkOrchestration() {
      try {
        const res = await fetch("/api/orchestrate/status");
        if (!res.ok) return;
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
        if (!res.ok) return;
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
        if (!res.ok) return;
        const data = await res.json();
        setRunLogs(data.logs || []);
        // task 데이터도 주기적으로 갱신 (status 반영)
        const taskRes = await fetch(`/api/requests/${id}`);
        if (taskRes.ok) setTask(await taskRes.json());
        if (data.status !== "running") {
          setRunStatus(data.status);
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
      setActiveTab("logs");
      // task 데이터 refetch (status 반영)
      setTimeout(async () => {
        const taskRes = await fetch(`/api/requests/${id}`);
        if (taskRes.ok) setTask(await taskRes.json());
      }, 2000);
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
    <div className="space-y-5 max-w-3xl mx-auto">
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
          <select
            value={task.status}
            onChange={async (e) => {
              const newStatus = e.target.value;
              await fetch(`/api/requests/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
              const res = await fetch(`/api/requests/${id}`);
              if (res.ok) setTask(await res.json());
            }}
            className="text-xs font-medium bg-transparent border-none outline-none cursor-pointer hover:text-primary transition-colors"
          >
            {["pending", "stopped", "in_progress", "reviewing", "done", "failed", "rejected"].map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>
            ))}
          </select>
        </div>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", PRIORITY_COLORS[task.priority])}>
          {task.priority}
        </span>
        <span className="text-[11px] text-muted-foreground">
          Created: {task.created}
        </span>
        {task.branch && <BranchBadge branch={task.branch} />}

        {/* Run / Stop / Delete buttons */}
        <div className="ml-auto flex items-center gap-2">
          {runStatus === "running" && (
            <HorseRunningIndicator />
          )}
          {task.status === "pending" && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`${displayTaskId(task.id)} 삭제하시겠습니까?`)) return;
                const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
                if (res.ok) router.push("/tasks");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/50 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              삭제
            </button>
          )}
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
              disabled={isPipelineRunning || task.status === "in_progress" || task.status === "done" || task.status === "rejected"}
              title={
                isPipelineRunning
                  ? "파이프라인 실행 중에는 개별 실행 불가"
                  : task.status === "in_progress"
                    ? "이미 실행 중인 태스크입니다"
                    : task.status === "done" || task.status === "rejected"
                      ? "완료된 태스크입니다"
                      : `${displayTaskId(task.id)} 실행`
              }
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors",
                isPipelineRunning || task.status === "in_progress" || task.status === "done" || task.status === "rejected"
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-muted hover:bg-muted/80 text-foreground border border-border",
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
      {((task.depends_on_detail?.length ?? 0) > 0 || (task.depended_by?.length ?? 0) > 0) && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Dependency Flow
          </h2>
          <div className="flex items-center gap-0">
            {task.depends_on_detail?.map((dep) => (
              <div key={dep.id} className="flex items-center gap-0 w-1/3 shrink-0">
                <button
                  type="button"
                  onClick={() => router.push(`/tasks/${dep.id}`)}
                  className="flex flex-col gap-1 px-2.5 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors flex-1 min-w-0"
                >
                  <div className="flex items-center gap-1.5">
                    {dep.status === "in_progress" ? (
                      <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[dep.status] || "bg-gray-400")} />
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground">{dep.id}</span>
                  </div>
                  <span className="text-[11px] leading-tight truncate">{dep.title}</span>
                </button>
                <span className="text-muted-foreground mx-1.5 text-sm shrink-0">&rarr;</span>
              </div>
            ))}
            <div className="flex flex-col gap-1 px-2.5 py-2 rounded-lg border-2 border-primary bg-primary/5 w-1/3 shrink-0 min-w-0">
              <div className="flex items-center gap-1.5">
                {task.status === "in_progress" ? (
                  <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[task.status] || "bg-gray-400")} />
                )}
                <span className="font-mono text-[10px] font-semibold">{task.id}</span>
              </div>
              <span className="text-[11px] leading-tight font-medium truncate">{task.title}</span>
            </div>
            {task.depended_by?.map((dep) => (
              <div key={dep.id} className="flex items-center gap-0 w-1/3 shrink-0">
                <span className="text-muted-foreground mx-1.5 text-sm shrink-0">&rarr;</span>
                <button
                  type="button"
                  onClick={() => router.push(`/tasks/${dep.id}`)}
                  className="flex flex-col gap-1 px-2.5 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors flex-1 min-w-0"
                >
                  <div className="flex items-center gap-1.5">
                    {dep.status === "in_progress" ? (
                      <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[dep.status] || "bg-gray-400")} />
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground">{dep.id}</span>
                  </div>
                  <span className="text-[11px] leading-tight truncate">{dep.title}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {([
          { key: "detail" as const, label: "Content", icon: FileText },
          { key: "scope" as const, label: "Scope", icon: FileText },
          { key: "cost" as const, label: "Cost", icon: DollarSign },
          { key: "ai-result" as const, label: "AI Result", icon: CheckCircle2 },
          { key: "logs" as const, label: "로그", icon: Terminal },
          { key: "review" as const, label: "리뷰 결과", icon: ClipboardCheck },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "detail" && (
        <div className="space-y-5">
          {/* Description */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Description
            </h2>
            {task.content ? (
              <MarkdownContent>{task.content}</MarkdownContent>
            ) : <p className="text-sm text-muted-foreground">(No description)</p>}
          </div>

        </div>
      )}

      {/* logs 탭은 아래에서 통합 렌더링 */}

      {activeTab === "scope" && (
        <div>
          {task.scope?.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {task.scope.map((s, i) => (
                <span key={i} className="inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">{s}</span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Scope가 지정되지 않았습니다.</p>
          )}
        </div>
      )}

      {activeTab === "ai-result" && (
        <div>
          {aiResultLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : aiResult ? (
            <MarkdownContent>{aiResult}</MarkdownContent>
          ) : (
            <p className="text-sm text-muted-foreground">아직 AI 결과가 없습니다.</p>
          )}
        </div>
      )}

      {activeTab === "cost" && (
        task.costEntries && task.costEntries.length > 0 ? (
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
        ) : (
          <div className="text-center py-12 text-sm text-muted-foreground">
            {task.status === "in_progress" ? "태스크 완료 후 비용 정보가 표시됩니다." : "비용 정보가 없습니다."}
          </div>
        )
      )}

      {activeTab === "review" && (
        task.reviewResult ? (
          <div className="space-y-3">
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
              <div className="p-3 bg-muted rounded max-h-[60vh] overflow-y-auto">
                <MarkdownContent>{String(task.reviewResult.result)}</MarkdownContent>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">아직 리뷰 결과가 없습니다.</p>
        )
      )}

      {activeTab === "logs" && (
        runStatus === "running" ? (
          <div className="rounded-lg border border-border overflow-hidden bg-[#0d1117]">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#161b22] border-b border-border">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">RUN — {id}</span>
              <span className="text-[10px] text-zinc-600 ml-auto font-mono">{runLogs.length} lines</span>
            </div>
            <div className="overflow-y-auto max-h-[500px] p-0 font-mono text-[11px] leading-[1.7]">
              {runLogs.map((line, i) => (
                <div key={i} className="px-3 py-0.5 hover:bg-white/[0.03] text-zinc-400">
                  <span className="text-zinc-600 select-none mr-3 inline-block w-5 text-right">{i + 1}</span>
                  {line}
                </div>
              ))}
            </div>
          </div>
        ) : task.status === "in_progress" ? (
          <LiveLogPanel taskId={id} />
        ) : task.executionLog ? (
          <div className="space-y-3">
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
              <div className="p-3 bg-muted rounded max-h-[60vh] overflow-y-auto">
                <MarkdownContent>{String(task.executionLog.result)}</MarkdownContent>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">아직 실행 로그가 없습니다.</p>
        )
      )}
    </div>
  );
}
