"use client";

import { useState, useEffect, useCallback, use, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errors/error-utils";
import { queryKeys } from "@/lib/query/query-keys";
import { getQueryClient } from "@/lib/query-client";
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
import { useTasksStore } from "@/store/tasksStore";
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
import type { TaskStatus } from "@/entities/task";

/** Internal tab keys (Tabs `key` prop). URL uses `tab` query (detail → `content`). */
export type TaskDetailTabKey =
  | "detail"
  | "scope"
  | "cost"
  | "logs"
  | "terminal"
  | "ai-result";

const TAB_QUERY_VALUE: Record<TaskDetailTabKey, string> = {
  detail: "content",
  scope: "scope",
  cost: "cost",
  logs: "logs",
  terminal: "terminal",
  "ai-result": "ai-result",
};

const QUERY_TO_TAB_KEY: Record<string, TaskDetailTabKey> = {
  content: "detail",
  scope: "scope",
  cost: "cost",
  logs: "logs",
  terminal: "terminal",
  "ai-result": "ai-result",
};

function tabKeyFromQuery(tabParam: string | null): TaskDetailTabKey {
  if (!tabParam) return "detail";
  return QUERY_TO_TAB_KEY[tabParam.toLowerCase()] ?? "detail";
}

function syncTasksCaches() {
  void getQueryClient().invalidateQueries({ queryKey: queryKeys.tasks.all });
  void useTasksStore.getState().fetchTasksSummary();
}

function TaskDetailPageViewInner({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const {
    data: task,
    isLoading,
    error: loadError,
    refetch: refetchTask,
  } = useQuery({
    queryKey: queryKeys.tasks.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${id}`);
      if (!res.ok) throw new Error("Task not found");
      return (await res.json()) as TaskDetail;
    },
  });
  const error = loadError ? getErrorMessage(loadError, "Failed to load task") : null;
  const activeTab = tabKeyFromQuery(searchParams.get("tab"));

  const navigateToTaskTab = useCallback((key: TaskDetailTabKey) => {
    const next = new URLSearchParams(window.location.search);
    next.set("tab", TAB_QUERY_VALUE[key]);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router]);
  const [aiResult, setAiResult] = useState<
    { status: string; result: string } | null | "empty"
  >(null);
  const [aiResultLoading, setAiResultLoading] = useState(false);
  const [runStatus, setRunStatus] = useState<
    "idle" | "running" | "completed" | "failed"
  >("idle");
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);

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
      navigateToTaskTab("logs");
    }
  }, [task?.status, runStatus, navigateToTaskTab]);

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
      navigateToTaskTab("logs");
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
  }, [id, task, navigateToTaskTab]);

  // Refetch task data when run finishes (status 반영)
  const handleRunStatusChange = useCallback(
    async (status: string) => {
      if (status === "completed" || status === "failed") {
        setRunStatus(status as "completed" | "failed");
        // 사이드바 즉시 반영: done 또는 failed로 전환
        const finalStatus = status === "completed" ? "done" : "failed";
        queryClient.setQueryData<TaskDetail>(queryKeys.tasks.detail(id), (prev) =>
          prev ? { ...prev, status: finalStatus } : prev,
        );
        syncTasksCaches();
        void refetchTask();
      }
    },
    [id, queryClient, refetchTask],
  );

  const handleStatusChange = async (newStatus: string) => {
    queryClient.setQueryData<TaskDetail>(queryKeys.tasks.detail(id), (prev) =>
      prev ? { ...prev, status: newStatus as TaskStatus } : prev,
    );
    await fetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    syncTasksCaches();
    void refetchTask();
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
      queryClient.setQueryData<TaskDetail>(queryKeys.tasks.detail(id), (prev) =>
        prev ? { ...prev, status: "in_progress" } : prev,
      );
      syncTasksCaches();
      navigateToTaskTab("logs");
      setTimeout(() => {
        void refetchTask();
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
      queryClient.setQueryData<TaskDetail>(queryKeys.tasks.detail(id), (prev) =>
        prev ? { ...prev, status: "stopped" } : prev,
      );
      syncTasksCaches();
      setTimeout(() => {
        void refetchTask();
      }, 500);
      if (!res.ok) {
        await res.json().catch(() => {});
        // 409는 이미 멈춘 경우 → 무시, 그 외에만 무시
        // (non-critical error)
      }
    } catch {
      // 네트워크 오류도 UI는 즉시 반영
      setRunStatus("idle");
      queryClient.setQueryData<TaskDetail>(queryKeys.tasks.detail(id), (prev) =>
        prev ? { ...prev, status: "stopped" } : prev,
      );
      syncTasksCaches();
    }
  };

  const handleDelete = async () => {
    if (!confirm(`${task?.display_id ?? task?.id} 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
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
        onChange={navigateToTaskTab}
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

export default function TaskDetailPageView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <TaskDetailPageViewInner params={params} />
    </Suspense>
  );
}
