"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getErrorMessage } from "@/lib/error-utils";

export interface NoticeItem {
  id: string;
  title: string;
  type: "info" | "warning" | "error" | "request";
  read: boolean;
  created: string;
  updated: string;
  content: string;
}

async function fetchNotices(): Promise<NoticeItem[]> {
  const res = await fetch("/api/notices");
  if (!res.ok) throw new Error("알림을 불러오는데 실패했습니다.");
  return res.json();
}

export function useNotices() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.notices.list();

  const { data: notices = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: fetchNotices,
    staleTime: 30_000,
  });

  // ── 생성
  const createMutation = useMutation({
    mutationFn: async (vars: { title: string; content: string; type: string }) => {
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error("알림 생성에 실패했습니다.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notices.all });
    },
  });

  // ── 수정 (낙관적 업데이트: 읽음 처리 즉시 반영)
  const updateMutation = useMutation({
    mutationFn: async (vars: { id: string; updates: Partial<Pick<NoticeItem, "title" | "content" | "type" | "read">> }) => {
      const res = await fetch(`/api/notices/${vars.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars.updates),
      });
      if (!res.ok) throw new Error("알림 수정에 실패했습니다.");
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<NoticeItem[]>(queryKey);
      queryClient.setQueryData<NoticeItem[]>(queryKey, (old = []) =>
        old.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      );
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notices.all });
    },
  });

  // ── 삭제 (낙관적 업데이트)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notices/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("알림 삭제에 실패했습니다.");
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<NoticeItem[]>(queryKey);
      queryClient.setQueryData<NoticeItem[]>(queryKey, (old = []) =>
        old.filter((n) => n.id !== id),
      );
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notices.all });
    },
  });

  const unreadCount = notices.filter((n) => !n.read).length;

  return {
    notices,
    isLoading,
    error: error ? getErrorMessage(error, "오류 발생") : null,
    unreadCount,
    createNotice: (title: string, content: string, type: string) =>
      createMutation.mutateAsync({ title, content, type }),
    updateNotice: (id: string, updates: Partial<Pick<NoticeItem, "title" | "content" | "type" | "read">>) =>
      updateMutation.mutateAsync({ id, updates }),
    deleteNotice: (id: string) => deleteMutation.mutateAsync(id),
    refetch: () => queryClient.invalidateQueries({ queryKey: queryKeys.notices.all }),
  };
}
