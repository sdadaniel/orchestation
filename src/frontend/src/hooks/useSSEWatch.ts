"use client";

import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 1000;
const RECONNECT_MS = 2000;

/**
 * SSE 엔드포인트를 구독하며, "changed" 이벤트 수신 시 onChanged 콜백을 디바운스해 호출한다.
 * 연결 오류 시 2초 후 재연결하며, 컴포넌트 언마운트 시 정리한다.
 */
export function useSSEWatch(url: string, onChanged: () => void): void {
  // 최신 콜백 참조 유지 (리렌더링마다 effect 재실행 방지)
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!destroyed) onChangedRef.current();
      }, DEBOUNCE_MS);
    };

    const connect = () => {
      if (destroyed) return;
      es = new EventSource(url);

      es.onmessage = (e) => {
        if (e.data === "changed") debouncedRefetch();
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (!destroyed) {
          reconnectTimer = setTimeout(connect, RECONNECT_MS);
        }
      };
    };

    connect();

    return () => {
      destroyed = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [url]);
}
