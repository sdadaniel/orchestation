"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export interface RequestItem {
  id: string;
  title: string;
  status: "pending" | "stopped" | "in_progress" | "reviewing" | "done" | "failed" | "rejected";
  priority: "high" | "medium" | "low";
  created: string;
  updated: string;
  content: string;
  scope: string[];
  sort_order: number;
}

async function fetchRequests(): Promise<RequestItem[]> {
  const res = await fetch("/api/requests");
  if (!res.ok) throw new Error("요청 데이터를 불러오는데 실패했습니다.");
  return res.json();
}

export function useRequests() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.requests.list();

  const { data: requests = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: fetchRequests,
    staleTime: 5_000,
  });

  // ── 생성
  const createMutation = useMutation({
    mutationFn: async (vars: { title: string; content: string; priority: string }) => {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error("요청 생성에 실패했습니다.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });

  // ── 수정 (낙관적 업데이트)
  const updateMutation = useMutation({
    mutationFn: async (vars: { id: string; updates: Partial<Pick<RequestItem, "status" | "title" | "content" | "priority">> }) => {
      const res = await fetch(`/api/requests/${vars.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars.updates),
      });
      if (!res.ok) throw new Error("요청 수정에 실패했습니다.");
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<RequestItem[]>(queryKey);
      queryClient.setQueryData<RequestItem[]>(queryKey, (old = []) =>
        old.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      );
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });

  // ── 삭제 (낙관적 업데이트)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("요청 삭제에 실패했습니다.");
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<RequestItem[]>(queryKey);
      queryClient.setQueryData<RequestItem[]>(queryKey, (old = []) =>
        old.filter((r) => r.id !== id),
      );
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });

  // ── 순서 변경 (낙관적 업데이트)
  const reorderMutation = useMutation({
    mutationFn: async (vars: { id: string; direction: "up" | "down" }) => {
      const res = await fetch(`/api/requests/${vars.id}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: vars.direction }),
      });
      if (!res.ok) throw new Error("순서 변경에 실패했습니다.");
    },
    onMutate: async ({ id, direction }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<RequestItem[]>(queryKey);
      queryClient.setQueryData<RequestItem[]>(queryKey, (prev = []) => {
        const target = prev.find((r) => r.id === id);
        if (!target) return prev;
        const siblings = prev
          .filter((r) => r.status === target.status)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id));
        const sibIdx = siblings.findIndex((r) => r.id === id);
        const swapSibIdx = direction === "up" ? sibIdx - 1 : sibIdx + 1;
        if (swapSibIdx < 0 || swapSibIdx >= siblings.length) return prev;
        const other = siblings[swapSibIdx];
        if (!other) return prev;
        const tmpOrder = target.sort_order;
        return prev.map((r) => {
          if (r.id === target.id) return { ...r, sort_order: other.sort_order };
          if (r.id === other.id) return { ...r, sort_order: tmpOrder };
          return r;
        });
      });
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return {
    requests,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "오류 발생") : null,
    pendingCount,
    createRequest: (title: string, content: string, priority: string) =>
      createMutation.mutateAsync({ title, content, priority }),
    updateRequest: (id: string, updates: Partial<Pick<RequestItem, "status" | "title" | "content" | "priority">>) =>
      updateMutation.mutateAsync({ id, updates }),
    deleteRequest: (id: string) => deleteMutation.mutateAsync(id),
    reorderRequest: (id: string, direction: "up" | "down") =>
      reorderMutation.mutateAsync({ id, direction }),
    refetch,
  };
}
