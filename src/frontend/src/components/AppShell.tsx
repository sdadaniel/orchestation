"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTasks } from "@/hooks/useTasks";
import { usePrds } from "@/hooks/usePrds";
import { useDocTree } from "@/hooks/useDocTree";
import { useOrchestrationStore } from "@/store/orchestrationStore";
import { useTasksStore } from "@/store/tasksStore";
import { TaskSidebar } from "@/components/sidebar";
import { TaskLogModal } from "@/components/TaskLogModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ChatBot } from "@/components/ChatBot";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useNotices } from "@/hooks/useNotices";
import { RunningIndicator } from "@/components/RunningIndicator";
import AutoImproveControl from "@/components/AutoImproveControl";
import type { WaterfallTask } from "@/types/waterfall";
import type { RequestItem } from "@/store/tasksStore";
import { useState } from "react";

/* ── Home Dashboard ── */

function HomeDashboard({ requestItems }: { requestItems: RequestItem[] }) {
  const inProgress = requestItems.filter((t) => t.status === "in_progress");
  const pending = requestItems.filter(
    (t) => t.status === "pending" || t.status === "reviewing",
  );
  const done = requestItems.filter((t) => t.status === "done");
  const rejected = requestItems.filter((t) => t.status === "rejected");

  return (
    <div className="space-y-6">
      {/* 상태 요약 */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Overview</h2>
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-1">In Progress</div>
            <div className="text-2xl font-bold text-blue-500">
              {inProgress.length}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-1">Pending</div>
            <div className="text-2xl font-bold text-yellow-500">
              {pending.length}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-1">Done</div>
            <div className="text-2xl font-bold text-emerald-500">
              {done.length}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-1">Rejected</div>
            <div className="text-2xl font-bold text-red-500">
              {rejected.length}
            </div>
          </div>
        </div>
      </div>

      {/* Active Tasks */}
      {inProgress.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Active Tasks</h2>
          <div className="space-y-1">
            {inProgress.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2"
              >
                <span className="w-3 h-3 shrink-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                  {task.id}
                </span>
                <span className="text-sm flex-1 truncate">{task.title}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded text-blue-500 bg-blue-500/10">
                  In Progress
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Tasks */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Pending Tasks</h2>
          <div className="space-y-1">
            {pending.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full shrink-0 bg-yellow-500" />
                <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                  {task.id}
                </span>
                <span className="text-sm flex-1 truncate">{task.title}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded text-yellow-500 bg-yellow-500/10">
                  {task.status === "reviewing" ? "Reviewing" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {inProgress.length === 0 &&
        pending.length === 0 &&
        requestItems.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">All tasks completed.</p>
          </div>
        )}

      {requestItems.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">
            No tasks yet. Create a new task from the sidebar.
          </p>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { groups, isLoading, error } = useTasks();
  const { prds } = usePrds();
  const {
    tree: docTree,
    createDoc,
    updateDoc,
    deleteDoc,
    reorderDoc,
    fetchTree,
  } = useDocTree();
  const { addToast } = useToast();
  const [logModalTask, setLogModalTask] = useState<WaterfallTask | null>(null);

  // Orchestration 상태를 store에서 직접 구독
  const justFinished = useOrchestrationStore((s) => s.justFinished);
  const clearFinished = useOrchestrationStore((s) => s.clearFinished);

  // Requests는 store에서 직접 구독
  const requestItems = useTasksStore((s) => s.requests);
  const fetchAll = useTasksStore((s) => s.fetchAll);
  const { notices: noticeItems } = useNotices();

  // Track previous task statuses for change detection
  const prevTaskStatusRef = useRef<Map<string, string>>(new Map());

  // Detect task status changes and show toasts
  useEffect(() => {
    if (isLoading) return;
    const allTasks = groups.flatMap((g) => g.tasks);
    const prevMap = prevTaskStatusRef.current;

    if (prevMap.size > 0) {
      for (const task of allTasks) {
        const prevStatus = prevMap.get(task.id);
        if (prevStatus && prevStatus !== task.status) {
          if (task.status === "done") {
            addToast(`${task.id}: "${task.title}" 완료됨`, "success");
          } else if (task.status === "in_progress" && prevStatus === "pending") {
            addToast(`${task.id}: "${task.title}" 시작됨`, "info");
          } else if (
            task.status === "in_review" ||
            task.status === "reviewing"
          ) {
            addToast(`${task.id}: "${task.title}" 리뷰 중`, "info");
          }
        }
      }
    }

    const newMap = new Map<string, string>();
    for (const task of allTasks) {
      newMap.set(task.id, task.status);
    }
    prevTaskStatusRef.current = newMap;
  }, [groups, isLoading, addToast]);

  // Auto-refresh all data when orchestration finishes
  useEffect(() => {
    if (justFinished) {
      fetchAll();
      clearFinished();
    }
  }, [justFinished, fetchAll, clearFinished]);

  const isHome = pathname === "/";

  // Doc tree handlers
  const handleDocCreate = useCallback(
    async (title: string, type: "doc" | "folder", parentId?: string | null) => {
      await createDoc(title, type, parentId);
    },
    [createDoc],
  );

  const handleDocDelete = useCallback(
    async (id: string) => {
      await deleteDoc(id);
    },
    [deleteDoc],
  );

  const handleDocRename = useCallback(
    async (id: string, title: string) => {
      await updateDoc(id, { title });
    },
    [updateDoc],
  );

  const handleDocReorder = useCallback(
    async (
      nodeId: string,
      targetParentId: string | null,
      position: number,
    ) => {
      await reorderDoc(nodeId, targetParentId, position);
    },
    [reorderDoc],
  );

  const handleDocReorderError = useCallback(
    async (_error: unknown) => {
      await fetchTree();
    },
    [fetchTree],
  );

  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="ide-sidebar p-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-5 w-full mb-2 rounded" />
          ))}
        </div>
        <div className="flex-1 p-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-7 w-full mb-1 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <TaskSidebar
        prds={prds}
        docTree={docTree}
        requestItems={requestItems}
        noticeItems={noticeItems}
        currentPath={pathname}
        onDocCreate={handleDocCreate}
        onDocDelete={handleDocDelete}
        onDocRename={handleDocRename}
        onDocReorder={handleDocReorder}
        onDocReorderError={handleDocReorderError}
        onStopTask={async (id) => {
          try { await fetch(`/api/tasks/${id}/run`, { method: "DELETE" }); } catch {}
          await fetch(`/api/requests/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "stopped" }) });
          fetchAll();
        }}
      />

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Global header */}
        <div className="global-header">
          <RunningIndicator requestItems={requestItems} />
          <AutoImproveControl />
          <GlobalSearch requestItems={requestItems} docTree={docTree} />
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {isHome ? (
            <div className="flex-1 overflow-auto bg-background p-4">
              <div className="content-container">
                <HomeDashboard requestItems={requestItems} />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto bg-background p-4">
              <div className="content-container">{children}</div>
            </div>
          )}
        </div>
      </div>

      {/* ChatBot */}
      <ChatBot />

      {/* Task Log Modal */}
      {logModalTask && (
        <TaskLogModal
          task={logModalTask}
          onClose={() => setLogModalTask(null)}
        />
      )}
    </div>
  );
}
