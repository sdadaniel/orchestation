"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { getErrorMessage } from "@/lib/errors/error-utils";

export interface NoticeSummaryItem {
  id: string;
  display_id?: string;
  title: string;
  type: "info" | "warning" | "error" | "request";
  created: string;
  updated: string;
}

export interface NoticeSummaryData {
  items: NoticeSummaryItem[];
  total: number;
  unreadCount: number;
  page: number;
  size: number;
}

async function fetchNoticeSummary(): Promise<NoticeSummaryData> {
  const res = await fetch("/api/notices?page=1&size=5&filter=unread&summary=1");
  if (!res.ok) throw new Error("알림 요약을 불러오는데 실패했습니다.");
  return res.json();
}

export function useNoticeSummary() {
  const {
    data = { items: [], total: 0, unreadCount: 0, page: 1, size: 5 },
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.notices.summary(),
    queryFn: fetchNoticeSummary,
    staleTime: 30_000,
  });

  return {
    summary: data,
    isLoading,
    error: error ? getErrorMessage(error, "오류 발생") : null,
  };
}
