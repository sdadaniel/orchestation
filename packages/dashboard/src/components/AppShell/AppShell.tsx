"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTasks } from "@/hooks/useTasks";
import { usePrds } from "@/hooks/usePrds";
import { useDocTree } from "@/hooks/useDocTree";
import { useOrchestrationStore } from "@/store/orchestrationStore";
import { useTasksStore } from "@/store/tasksStore";
import { Sidebar } from "@/components/Sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ChatBot } from "@/components/ChatBot";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useNotices } from "@/hooks/useNotices";
import AutoImproveControl from "@/components/AutoImproveControl";
import { useDocActions } from "./hooks/useDocActions";
import { HomeDashboard } from "./components";

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const { groups, isLoading } = useTasks();
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

  // 초기 데이터 로드 — 이후 변경 감지는 Gateway WS 이벤트로 처리
  useEffect(() => {
    useTasksStore.getState().fetchAll();
  }, []);

  // Orchestration 상태를 store에서 직접 구독
  const justFinished = useOrchestrationStore((s) => s.justFinished);
  const clearFinished = useOrchestrationStore((s) => s.clearFinished);

  // Requests는 store에서 직접 구독
  const requestItems = useTasksStore((s) => s.requests);
  const fetchAll = useTasksStore((s) => s.fetchAll);
  const { notices: noticeItems } = useNotices();

  // Track previous task statuses for change detection
  const prevTaskStatusRef = useRef<Map<string, string>>(new Map());
  const toastedRef = useRef<Set<string>>(new Set());

  // Detect task status changes and show toasts
  useEffect(() => {
    if (isLoading) return;
    const allTasks = groups.flatMap((g) => g.tasks);
    const prevMap = prevTaskStatusRef.current;

    // 초기 로드가 아닌 경우에만 토스트 (prevMap이 비어있으면 초기 로드)
    if (prevMap.size > 0) {
      for (const task of allTasks) {
        const prev = prevMap.get(task.id);
        if (prev === undefined || prev === task.status) continue;

        // 동일 task+status 조합에 대해 중복 토스트 방지
        const toastKey = `${task.id}:${task.status}`;
        if (toastedRef.current.has(toastKey)) continue;
        toastedRef.current.add(toastKey);

        if (task.status === "done") {
          addToast(`${task.id}: "${task.title}" 완료됨`, "success");
        } else if (task.status === "in_progress" && prev === "pending") {
          addToast(`${task.id}: "${task.title}" 시작됨`, "info");
        } else if (task.status === "reviewing") {
          addToast(`${task.id}: "${task.title}" 리뷰 중`, "info");
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

  const docActions = useDocActions({
    createDoc,
    deleteDoc,
    updateDoc,
    reorderDoc,
    fetchTree,
  });

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
      <Sidebar
        prds={prds}
        docTree={docTree}
        requestItems={requestItems}
        noticeItems={noticeItems}
        currentPath={pathname}
        docActions={docActions}
        onStopTask={async (id: string) => {
          try {
            await fetch(`/api/tasks/${id}/run`, { method: "DELETE" });
          } catch {}
          await fetch(`/api/requests/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "stopped" }),
          });
          fetchAll();
        }}
      />

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Global header */}
        <div className="global-header">
          <AutoImproveControl
            runningTaskCount={
              requestItems.filter((t) => t.status === "in_progress").length
            }
          />
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
    </div>
  );
};

export default AppShell;
