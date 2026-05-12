"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTasks } from "@/hooks/useTasks";
import { useOrchestrationStore } from "@/store/orchestrationStore";
import { useTasksStore } from "@/store/tasksStore";
import Sidebar from "@/components/Sidebar";
import useSidebarCollapsed from "@/components/Sidebar/hooks/useSidebarCollapsed";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ChatBot } from "@/components/ChatBot";
import { GlobalHeader, HomeDashboard } from "./components";

const SIDEBAR_COLLAPSED_WIDTH = 48;

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const shouldLoadTaskGroups = (pathname ?? "").startsWith("/tasks");
  const { groups, isLoading } = useTasks(shouldLoadTaskGroups);
  const { addToast } = useToast();
  const fetchTasksSummary = useTasksStore((s) => s.fetchTasksSummary);
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebarCollapsed();
  const collapsedStyle = sidebarCollapsed
    ? { width: SIDEBAR_COLLAPSED_WIDTH }
    : undefined;

  // 초기 데이터 로드 — 홈/사이드바는 요약만 먼저 가져오고, 상세 목록은 해당 화면에서 로드
  useEffect(() => {
    fetchTasksSummary();
  }, [fetchTasksSummary]);

  // Orchestration 상태를 store에서 직접 구독
  const justFinished = useOrchestrationStore((s) => s.justFinished);
  const clearFinished = useOrchestrationStore((s) => s.clearFinished);

  // Requests는 store에서 직접 구독
  const fetchTasksSummaryOnFinish = useTasksStore((s) => s.fetchTasksSummary);

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
        const displayId = task.display_id ?? task.id;

        // 동일 task+status 조합에 대해 중복 토스트 방지
        const toastKey = `${task.id}:${task.status}`;
        if (toastedRef.current.has(toastKey)) continue;
        toastedRef.current.add(toastKey);

        if (task.status === "done") {
          addToast(`${displayId}: "${task.title}" 완료됨`, "success");
        } else if (task.status === "in_progress" && prev === "pending") {
          addToast(`${displayId}: "${task.title}" 시작됨`, "info");
        } else if (task.status === "reviewing") {
          addToast(`${displayId}: "${task.title}" 리뷰 중`, "info");
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
      fetchTasksSummaryOnFinish();
      clearFinished();
    }
  }, [justFinished, fetchTasksSummaryOnFinish, clearFinished]);

  const isHome = pathname === "/";

  if (isLoading) {
    return (
      <div className="flex h-full">
        <div
          className="ide-sidebar p-3"
          style={collapsedStyle}
          data-collapsed={sidebarCollapsed ? "true" : "false"}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton
              key={i}
              className={`h-5 mb-2 rounded ${sidebarCollapsed ? "w-6" : "w-full"}`}
            />
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
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Global header */}
        <GlobalHeader />

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {isHome ? (
            <div className="flex-1 overflow-auto bg-background p-4">
              <div className="content-container">
                <HomeDashboard />
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
