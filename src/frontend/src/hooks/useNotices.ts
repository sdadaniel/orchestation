"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface NoticeItem {
  id: string;
  title: string;
  type: "info" | "warning" | "error" | "request";
  read: boolean;
  created: string;
  updated: string;
  content: string;
}

export function useNotices() {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchNotices = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/notices", { signal: controller.signal });
      if (!res.ok) throw new Error("알림을 불러오는데 실패했습니다.");
      const data: NoticeItem[] = await res.json();
      if (isMountedRef.current) {
        setNotices(data);
        setError(null);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
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
    fetchNotices();
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchNotices]);

  const createNotice = useCallback(async (title: string, content: string, type: string) => {
    const res = await fetch("/api/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, type }),
    });
    if (!res.ok) throw new Error("알림 생성에 실패했습니다.");
    if (isMountedRef.current) await fetchNotices();
    return res.json();
  }, [fetchNotices]);

  const updateNotice = useCallback(async (id: string, updates: Partial<Pick<NoticeItem, "title" | "content" | "type" | "read">>) => {
    const res = await fetch(`/api/notices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("알림 수정에 실패했습니다.");
    if (isMountedRef.current) await fetchNotices();
  }, [fetchNotices]);

  const deleteNotice = useCallback(async (id: string) => {
    const res = await fetch(`/api/notices/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("알림 삭제에 실패했습니다.");
    if (isMountedRef.current) await fetchNotices();
  }, [fetchNotices]);

  const unreadCount = notices.filter((n) => !n.read).length;

  return { notices, isLoading, error, unreadCount, createNotice, updateNotice, deleteNotice, refetch: fetchNotices };
}
