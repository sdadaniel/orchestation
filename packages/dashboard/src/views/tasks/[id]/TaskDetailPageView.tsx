"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/errors/error-utils";
import {
  ArrowLeft,
  Loader2,
  FileText,
  Terminal,
  Monitor,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import { useOrchestrationStore } from "@/store/orchestrationStore";
import { useTasksStore, type RequestItem } from "@/store/tasksStore";
import { TaskDetail } from "@/app/tasks/[id]/types";
import { TaskMetadata } from "@/app/tasks/[id]/TaskMetadata";
import { DependencyFlow } from "@/app/tasks/[id]/DependencyFlow";
import {
  DetailTab,
  ScopeTab,
  AiResultTab,
  CostTab,
  LogsTab,
} from "@/app/tasks/[id]/TaskTabContent";
import { LiveTerminalPanel } from "@/components/TaskDetail/LiveTerminalPanel";
import { TaskWorkflowIndicator } from "@/components/TaskDetail/TaskWorkflowIndicator";
import { Tabs } from "@/components/ui";

export default function TaskDetailPageView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "detail" | "scope" | "cost" | "ai-result" | "logs" | "terminal"
  >("detail");
  const [aiResult, setAiResult] = useState<
    { status: string; result: string } | null | "empty"
  >(null);
  const [aiResultLoading, setAiResultLoading] = useState(false);
  const [runStatus, setRunStatus] = useState<
    "idle" | "running" | "completed" | "failed"
  >("idle");
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const taskKey = task?.id ?? id;

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
  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  // Gateway WS가 store를 업데이트하면 자동 refetch (중복 연결 방지)
  const storeRequests = useTasksStore((s) => s.requests);
  useEffect(() => {
    const match = storeRequests.find((r) => r.id === taskKey);
    if (match && task && match.status !== task.status) {
      fetchTask();
    }
  }, [storeRequests, taskKey, task, fetchTask]);

  // Lazy-load AI result
  useEffect(() => {
    if (activeTab === "ai-result" && aiResult === null && !aiResultLoading) {
      setAiResultLoading(true);
      fetch(`/api/tasks/${id}/result`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
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

  // Check if task is already running on page load (task 로드 후에만)
  useEffect(() => {
    if (!task) return;
    // pending/stopped면 이전 run 결과 무시
    if (task.status === "pending" || task.status === "stopped") {
      setRunStatus("idle");
      return;
    }
    // in_progress 상태면 running으로 간주
    if (task.status === "in_progress") {
      setRunStatus("running");
      setActiveTab("logs");
      return;
    }
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
        // silently ignore check errors
      }
    }
    checkRunStatus();
  }, [id, task]);

  // Refetch task data when run finishes (status 반영)
  const handleRunStatusChange = useCallback(
    async (status: string) => {
      if (status === "completed" || status === "failed") {
        setRunStatus(status as "completed" | "failed");
        // 사이드바 즉시 반영: done 또는 failed로 전환
        const finalStatus = status === "completed" ? "done" : "failed";
        useTasksStore.getState().patchRequest(taskKey, { status: finalStatus });
        // 최신 task 데이터 refetch
        try {
          const taskRes = await fetch(`/api/requests/${id}`);
          if (taskRes.ok) setTask(await taskRes.json());
        } catch {
          // silently ignore refetch errors
        }
      }
    },
    [id, taskKey],
  );

  const handleStatusChange = async (newStatus: string) => {
    // 사이드바 즉시 반영
    useTasksStore
      .getState()
      .patchRequest(taskKey, { status: newStatus as RequestItem["status"] });
    await fetch(`/api/requests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
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
      // 즉시 UI 업데이트: task 상태를 in_progress로 설정
      setRunStatus("running");
      setTask((prev) =>
        prev ? { ...prev, status: "in_progress" } : null
      );
      // 사이드바 즉시 반영
      useTasksStore.getState().patchRequest(taskKey, { status: "in_progress" });
      setActiveTab("logs");
      // task 데이터 refetch (status 확정)
      setTimeout(async () => {
        const taskRes = await fetch(`/api/requests/${id}`);
        if (taskRes.ok) setTask(await taskRes.json());
      }, 500);
    } catch {
      alert("실행 요청 실패");
    }
  };

  const handleStop = async () => {
    try {
      const res = await fetch(`/api/tasks/${id}/run`, { method: "DELETE" });
      // 응답 성공 여부와 관계없이 UI 즉시 반영
      setRunStatus("idle");
      setTask((prev) => (prev ? { ...prev, status: "stopped" } : null));
      // 사이드바 즉시 반영
      useTasksStore.getState().patchRequest(taskKey, { status: "stopped" });
      // 파일 상태도 반영된 최신 데이터로 refetch
      setTimeout(async () => {
        const taskRes = await fetch(`/api/requests/${id}`);
        if (taskRes.ok) setTask(await taskRes.json());
      }, 500);
      if (!res.ok) {
        await res.json().catch(() => {});
        // 409는 이미 멈춘 경우 → 무시, 그 외에만 무시
        // (non-critical error)
      }
    } catch {
      // 네트워크 오류도 UI는 즉시 반영
      setRunStatus("idle");
      setTask((prev) => (prev ? { ...prev, status: "stopped" } : null));
      useTasksStore.getState().patchRequest(taskKey, { status: "stopped" });
    }
  };

  const handleDelete = async () => {
    if (!confirm(`${task?.display_id ?? task?.id} 삭제하시겠습니까?`)) return;
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
    <div className="space-y-5 max-w-3xl mx-auto pb-[300px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/tasks")}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="font-mono text-xs text-muted-foreground">
          {task.display_id ?? task.id}
        </span>
        <h1 className="text-lg font-semibold flex-1">{task.title}</h1>
      </div>

      <TaskMetadata
        task={task}
        runStatus={runStatus}
        isPipelineRunning={isPipelineRunning}
        onStatusChange={handleStatusChange}
        onRun={handleRun}
        onStop={handleStop}
        onDelete={handleDelete}
      />

      {/* Dependency Flow — 탭 위 고정 */}
      <DependencyFlow task={task} />

      {/* Workflow (per-task steps) — Done(상태)와 탭 사이 */}
      <TaskWorkflowIndicator workflow={task.workflow} taskStatus={task.status} />

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: "detail", label: "Content", icon: FileText },
          { key: "scope", label: "Scope", icon: FileText },
          { key: "cost", label: "Cost", icon: DollarSign },
          { key: "logs", label: "로그", icon: Terminal },
          { key: "terminal", label: "Terminal", icon: Monitor },
          { key: "ai-result", label: "AI Result", icon: CheckCircle2 },
        ]}
      />

      {/* Tab Content */}
      {activeTab === "detail" && <DetailTab task={task} />}
      {activeTab === "scope" && <ScopeTab scope={task.scope} />}
      {activeTab === "ai-result" && (
        <AiResultTab
          aiResult={aiResult === "empty" ? null : aiResult}
          aiResultLoading={aiResultLoading}
          taskStatus={task.status}
        />
      )}
      {activeTab === "cost" && <CostTab task={task} />}
      {activeTab === "logs" && (
        <LogsTab
          taskId={task.id}
          runStatus={runStatus}
          taskStatus={task.status}
          hasExecutionLog={!!task.executionLog}
          onStatusChange={handleRunStatusChange}
        />
      )}
      {activeTab === "terminal" && <LiveTerminalPanel taskId={task.id} />}
    </div>
  );
}
