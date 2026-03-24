"use client";

import { useEffect, useState, useCallback } from "react";

export interface RequestItem {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "reviewing" | "done" | "rejected";
  priority: "high" | "medium" | "low";
  created: string;
  updated: string;
  content: string;
}

export function useRequests() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/requests");
      if (!res.ok) throw new Error("요청 데이터를 불러오는데 실패했습니다.");
      const data: RequestItem[] = await res.json();
      setRequests(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const createRequest = useCallback(async (title: string, content: string, priority: string) => {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, priority }),
    });
    if (!res.ok) throw new Error("요청 생성에 실패했습니다.");
    const data = await res.json();
    await fetchRequests();
    return data;
  }, [fetchRequests]);

  const updateRequest = useCallback(async (id: string, updates: Partial<Pick<RequestItem, "status" | "title" | "content" | "priority">>) => {
    const res = await fetch(`/api/requests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("요청 수정에 실패했습니다.");
    await fetchRequests();
  }, [fetchRequests]);

  const deleteRequest = useCallback(async (id: string) => {
    const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("요청 삭제에 실패했습니다.");
    await fetchRequests();
  }, [fetchRequests]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return { requests, isLoading, error, pendingCount, createRequest, updateRequest, deleteRequest, refetch: fetchRequests };
}
