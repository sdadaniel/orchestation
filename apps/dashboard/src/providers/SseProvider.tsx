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
import { useSseHandlers } from "./useSseHandlers";

const RECONNECT_DELAY = 3000;

export function SseProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);
  const { handleTaskChanged, handleOrchestrationStatus } = useSseHandlers(
    queryClient,
    mountedRef,
  );

  useEffect(() => {
    mountedRef.current = true;

    const cleanupEventSource = () => {
      esRef.current?.close();
      esRef.current = null;
    };

    const scheduleReconnect = (connectFn: () => void) => {
      if (!mountedRef.current) return;
      reconnectTimerRef.current = setTimeout(connectFn, RECONNECT_DELAY);
    };

    const connect = () => {
      if (!mountedRef.current) return;

      const es = new EventSource("/api/tasks/watch");
      esRef.current = es;

      // ── 태스크 파일 변경 — debounce 없이 즉시 처리 ──
      es.addEventListener("task-changed", handleTaskChanged as EventListener);

      // ── 오케스트레이션 상태 변경 ──
      es.addEventListener(
        "orchestration-status",
        handleOrchestrationStatus as EventListener,
      );

      es.onerror = () => {
        cleanupEventSource();
        scheduleReconnect(connect);
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      cleanupEventSource();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [queryClient]);

  return <>{children}</>;
}
