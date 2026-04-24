"use client";

import { useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { useOrchestrationStore } from "@/store/orchestrationStore";
import { useTasksStore } from "@/store/tasksStore";
import type { OrchestrationStatusData } from "@/gateway/orchestration-manager";

export function useSseHandlers(
  queryClient: QueryClient,
  mountedRef: React.RefObject<boolean>,
) {
  const invalidateTasksAndRequests = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
  }, [queryClient]);

  const handleTaskChanged = useCallback(
    (e: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(e.data);

        if (data.full || data.deleted) {
          // 전체 refetch 필요 (파싱 실패 또는 삭제)
          invalidateTasksAndRequests();
          useTasksStore.getState().fetchAll();
          return;
        }

        // 단일 항목 patch
        if (data.taskId) {
          const patch: Record<string, string> = {};
          if (data.status) patch.status = data.status;
          if (data.priority) patch.priority = data.priority;
          if (data.title) patch.title = data.title;

          const store = useTasksStore.getState();
          const exists = store.requests.some((r) => r.id === data.taskId);
          if (exists) {
            store.patchRequest(data.taskId, patch);
          } else {
            // 새 태스크 — store에 없으면 전체 refetch
            store.fetchAll();
          }

          // React Query 캐시도 갱신 (다른 컴포넌트에서 useQuery로 읽는 경우)
          invalidateTasksAndRequests();
        }
      } catch {
        // fallback: 전체 refetch
        invalidateTasksAndRequests();
      }
    },
    [invalidateTasksAndRequests, mountedRef],
  );

  const handleOrchestrationStatus = useCallback(
    (e: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const data: OrchestrationStatusData = JSON.parse(e.data);
        const store = useOrchestrationStore.getState();
        const prevStatus = store.data.status;
        const justFinished =
          prevStatus === "running" &&
          (data.status === "completed" ||
            data.status === "failed" ||
            data.status === "idle");

        useOrchestrationStore.setState(
          {
            data,
            isRunning: data.status === "running",
            justFinished: justFinished ? true : store.justFinished,
          },
          false,
          "orchestration/sse-update",
        );

        if (justFinished) {
          queryClient.invalidateQueries({ queryKey: queryKeys.costs.all });
          queryClient.invalidateQueries({
            queryKey: queryKeys.runHistory.all,
          });
        }
      } catch {
        // JSON 파싱 실패 무시
      }
    },
    [mountedRef, queryClient],
  );

  return { handleTaskChanged, handleOrchestrationStatus };
}

