"use client";

/**
 * SSE 단일 연결 관리자
 *
 * /api/tasks/watch에 하나의 EventSource를 유지하며 이벤트를 처리:
 * - task-changed          → store에 즉시 patch (debounce 없음)
 * - orchestration-status  → orchestrationStore 업데이트
 *
 * 앱 최상단(layout.tsx)에 마운트하여 전체 생명주기 동안 유지.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useOrchestrationStore } from "@/store/orchestrationStore";
import { useTasksStore } from "@/store/tasksStore";
import type { OrchestrationStatusData } from "@/engine/orchestration-manager";

const RECONNECT_DELAY = 3000;

export function SseProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const connect = () => {
      if (!mountedRef.current) return;

      const es = new EventSource("/api/tasks/watch");
      esRef.current = es;

      // ── 태스크 파일 변경 — debounce 없이 즉시 처리 ──
      es.addEventListener("task-changed", (e) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(e.data);

          if (data.full || data.deleted) {
            // 전체 refetch 필요 (파싱 실패 또는 삭제)
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
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
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
          }
        } catch {
          // fallback: 전체 refetch
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
        }
      });

      // ── 오케스트레이션 상태 변경 ──
      es.addEventListener("orchestration-status", (e) => {
        if (!mountedRef.current) return;
        try {
          const data: OrchestrationStatusData = JSON.parse(e.data);
          const store = useOrchestrationStore.getState();
          const prevStatus = store.data.status;
          const justFinished =
            prevStatus === "running" &&
            (data.status === "completed" || data.status === "failed");

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
            queryClient.invalidateQueries({ queryKey: queryKeys.runHistory.all });
          }
        } catch {
          // JSON 파싱 실패 무시
        }
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (mountedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY);
        }
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      esRef.current = null;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [queryClient]);

  return <>{children}</>;
}
