"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { RunHistoryEntry } from "@/lib/run-history";

export type { RunHistoryEntry };

type UseRunHistoryResult = {
  runs: RunHistoryEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

async function fetchRunHistory(): Promise<RunHistoryEntry[]> {
  const res = await fetch("/api/run-history");
  if (!res.ok) throw new Error("실행 기록을 불러오는데 실패했습니다.");
  const data = await res.json();
  return data.runs || [];
}

export function useRunHistory(): UseRunHistoryResult {
  const queryClient = useQueryClient();

  const { data: runs = [], isLoading, error } = useQuery({
    queryKey: queryKeys.runHistory.list(),
    queryFn: fetchRunHistory,
    // 실행 이력: staleTime 60s (orchestration 완료 시 invalidate)
    staleTime: 60_000,
  });

  return {
    runs,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.") : null,
    refetch: () => queryClient.invalidateQueries({ queryKey: queryKeys.runHistory.all }),
  };
}
