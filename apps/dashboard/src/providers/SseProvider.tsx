"use client";

/**
 * SSE 단일 연결 관리자
 *
 * /sse에 하나의 EventSource를 유지하며 이벤트를 처리:
 * - task-changed          → store에 즉시 patch (debounce 없음)
 * - orchestration-status  → orchestrationStore 업데이트
 *
 * 앱 최상단(layout.tsx)에 마운트하여 전체 생명주기 동안 유지.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSseHandlers } from "./useSseHandlers";
import { connectSse } from "@/sse/client";

const RECONNECT_DELAY = 3000;

export function SseProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const { handleTaskChanged, handleOrchestrationStatus } = useSseHandlers(
    queryClient,
    mountedRef,
  );

  useEffect(() => {
    mountedRef.current = true;

    const disconnect = connectSse({
      url: "/sse",
      lastEventIdKey: "lastEventId",
      onEvent: (evt) => {
        if (!mountedRef.current) return;
        if (evt.type === "task-changed") {
          handleTaskChanged(
            new MessageEvent("task-changed", { data: JSON.stringify(evt.data) }),
          );
        } else if (evt.type === "orchestration-status") {
          handleOrchestrationStatus(
            new MessageEvent("orchestration-status", {
              data: JSON.stringify(evt.data),
            }),
          );
        }
      },
    });

    return () => {
      mountedRef.current = false;
      disconnect();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [queryClient]);

  return <>{children}</>;
}
