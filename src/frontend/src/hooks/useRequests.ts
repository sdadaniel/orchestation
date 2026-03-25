"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface RequestItem {
  id: string;
  title: string;
  status: "pending" | "stopped" | "in_progress" | "reviewing" | "done" | "rejected";
  priority: "high" | "medium" | "low";
  created: string;
  updated: string;
  content: string;
  scope: string[];
  sort_order: number;
}

export function useRequests() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchRequests = useCallback(async () => {
    // Abort any in-flight request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/requests", { signal: controller.signal });
      if (!res.ok) throw new Error("요청 데이터를 불러오는데 실패했습니다.");
      const data: RequestItem[] = await res.json();
      if (isMountedRef.current) {
        setRequests(data);
        setError(null);
      }
    } catch (err) {
      // Ignore abort errors — they are expected on unmount or re-fetch
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "오류 발생");
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchRequests();

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchRequests]);

  // SSE: task 파일 변경 시 디바운스 후 자동 갱신
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isMountedRef.current) fetchRequests();
      }, 1000);
    };

    const connect = () => {
      es = new EventSource("/api/tasks/watch");
      es.onmessage = (e) => {
        if (e.data === "changed") debouncedRefetch();
      };
      es.onerror = () => {
        es?.close();
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [fetchRequests]);

  const createRequest = useCallback(async (title: string, content: string, priority: string) => {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, priority }),
    });
    if (!res.ok) throw new Error("요청 생성에 실패했습니다.");
    const data = await res.json();
    if (isMountedRef.current) {
      await fetchRequests();
    }
    return data;
  }, [fetchRequests]);

  const updateRequest = useCallback(async (id: string, updates: Partial<Pick<RequestItem, "status" | "title" | "content" | "priority">>) => {
    const res = await fetch(`/api/requests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("요청 수정에 실패했습니다.");
    if (isMountedRef.current) {
      await fetchRequests();
    }
  }, [fetchRequests]);

  const deleteRequest = useCallback(async (id: string) => {
    const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("요청 삭제에 실패했습니다.");
    if (isMountedRef.current) {
      await fetchRequests();
    }
  }, [fetchRequests]);

  const reorderRequest = useCallback(async (id: string, direction: "up" | "down") => {
    // 낙관적 업데이트: sort_order 값만 스왑 (배열 구조 유지, 최소 변경)
    setRequests((prev) => {
      const target = prev.find((r) => r.id === id);
      if (!target) return prev;
      const siblings = prev
        .filter((r) => r.status === target.status)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id));
      const sibIdx = siblings.findIndex((r) => r.id === id);
      const swapSibIdx = direction === "up" ? sibIdx - 1 : sibIdx + 1;
      if (swapSibIdx < 0 || swapSibIdx >= siblings.length) return prev;
      const other = siblings[swapSibIdx];
      const tmpOrder = target.sort_order;
      return prev.map((r) => {
        if (r.id === target.id) return { ...r, sort_order: other.sort_order };
        if (r.id === other.id) return { ...r, sort_order: tmpOrder };
        return r;
      });
    });
    // 서버에 반영 (실패 시 refetch로 복구)
    try {
      const res = await fetch(`/api/requests/${id}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      if (!res.ok) throw new Error();
    } catch {
      if (isMountedRef.current) await fetchRequests();
    }
  }, [fetchRequests]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return { requests, isLoading, error, pendingCount, createRequest, updateRequest, deleteRequest, reorderRequest, refetch: fetchRequests };
}
