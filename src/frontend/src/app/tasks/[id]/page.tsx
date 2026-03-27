"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, FileText, Terminal, CheckCircle2, DollarSign } from "lucide-react";
import { useOrchestrationStore } from "@/store/orchestrationStore";
import { TaskDetail } from "./types";
import { TaskMetadata } from "./TaskMetadata";
import { DependencyFlow } from "./DependencyFlow";
import { DetailTab, ScopeTab, AiResultTab, CostTab, LogsTab } from "./TaskTabContent";

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"detail" | "scope" | "cost" | "ai-result" | "logs">("detail");
  const [aiResult, setAiResult] = useState<{ status: string; result: string } | null | "empty">(null);
  const [aiResultLoading, setAiResultLoading] = useState(false);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);

  const fetchTask = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${id}`);
      if (!res.ok) throw new Error("Task not found");
      const data = await res.json();
      setTask(data);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load task"));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // 초기 로드
  useEffect(() => { fetchTask(); }, [fetchTask]);

  // SSE task-changed 이벤트 시 자동 refetch
  useEffect(() => {
    const es = new EventSource("/api/tasks/watch");
    es.addEventListener("task-changed", () => { fetchTask(); });
    return () => es.close();
  }, [fetchTask]);

  // Lazy-load AI result
  useEffect(() => {
    if (activeTab === "ai-result" && aiResult === null && !aiResultLoading) {
      setAiResultLoading(true);
      fetch(`/api/tasks/${id}/result`)
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((data) => setAiResult(data.status ? data : "empty"))
        .catch(() => setAiResult("empty"))
        .finally(() => setAiResultLoading(false));
    }
  }, [activeTab, aiResult, aiResultLoading, id]);

  // Auto-switch to logs tab when task is running
  useEffect(() => {
    if (task?.status === "in_progress" || runStatus === "running") {
      setActiveTab("logs");
    }
  }, [task?.status, runStatus]);

  // Orchestration 상태는 store에서 구독 (중복 interval 제거)
  const isPipelineRunningFromStore = useOrchestrationStore((s) => s.isRunning);
  useEffect(() => {
    setIsPipelineRunning(isPipelineRunningFromStore);
  }, [isPipelineRunningFromStore]);

  // Check if task is already running on page load
  useEffect(() => {
    async function checkRunStatus() {
      try {
        const res = await fetch(`/api/tasks/${id}/run`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "running") {
          setRunStatus("running");
        } else if (data.status === "completed" || data.status === "failed") {
          setRunStatus(data.status);
        }
      } catch {
        // ignore
      }
    }
    checkRunStatus();
  }, [id]);

  // Refetch task data when run finishes (status 반영)
  const handleRunStatusChange = useCallback(async (status: string) => {
    if (status === "completed" || status === "failed") {
      setRunStatus(status as "completed" | "failed");
      try {
        const taskRes = await fetch(`/api/requests/${id}`);
        if (taskRes.ok) setTask(await taskRes.json());
      } catch { /* ignore */ }
    }
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    await fetch(`/api/requests/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    const res = await fetch(`/api/requests/${id}`);
    if (res.ok) setTask(await res.json());
  };

  const handleRun = async () => {
    try {
      const res = await fetch(`/api/tasks/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "실행 실패");
        return;
      }
      setRunStatus("running");
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
      const res = await fetch(`/api/tasks/${id}/run`, { method: "DELETE" });
      // 응답 성공 여부와 관계없이 UI 즉시 반영
      setRunStatus("idle");
      setTask((prev) => prev ? { ...prev, status: "stopped" } : null);
      // 파일 상태도 반영된 최신 데이터로 refetch
      setTimeout(async () => {
        const taskRes = await fetch(`/api/requests/${id}`);
        if (taskRes.ok) setTask(await taskRes.json());
      }, 500);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // 409는 이미 멈춘 경우 → 무시, 그 외에만 알림
        if (res.status !== 409) {
          console.warn("Stop failed:", data.error);
        }
      }
    } catch {
      // 네트워크 오류도 UI는 즉시 반영
      setRunStatus("idle");
      setTask((prev) => prev ? { ...prev, status: "stopped" } : null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`${task?.id} 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/tasks");
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
        <span className="font-mono text-xs text-muted-foreground">{task.id}</span>
        <h1 className="text-lg font-semibold flex-1">{task.title}</h1>
      </div>

      <TaskMetadata
        task={task}
        id={id}
        runStatus={runStatus}
        isPipelineRunning={isPipelineRunning}
        onStatusChange={handleStatusChange}
        onRun={handleRun}
        onStop={handleStop}
        onDelete={handleDelete}
      />

      {/* Dependency Flow — 탭 위 고정 */}
      <DependencyFlow task={task} />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {([
          { key: "detail" as const, label: "Content", icon: FileText },
          { key: "scope" as const, label: "Scope", icon: FileText },
          { key: "cost" as const, label: "Cost", icon: DollarSign },
          { key: "ai-result" as const, label: "AI Result", icon: CheckCircle2 },
          { key: "logs" as const, label: "로그", icon: Terminal },
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
      {activeTab === "detail" && <DetailTab task={task} />}
      {activeTab === "scope" && <ScopeTab scope={task.scope} />}
      {activeTab === "ai-result" && <AiResultTab aiResult={aiResult === "empty" ? null : aiResult} aiResultLoading={aiResultLoading} taskStatus={task.status} />}
      {activeTab === "cost" && <CostTab task={task} />}
      {activeTab === "logs" && (
        <LogsTab
          taskId={id}
          runStatus={runStatus}
          taskStatus={task.status}
          hasExecutionLog={!!task.executionLog}
          onStatusChange={handleRunStatusChange}
        />
      )}
    </div>
  );
}
