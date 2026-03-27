"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export interface Prd {
  id: string;
  title: string;
  status: string;
  content: string;
}

async function fetchPrds(): Promise<Prd[]> {
  const res = await fetch("/api/prds");
  if (!res.ok) throw new Error("PRD 데이터를 불러오는데 실패했습니다.");
  return res.json();
}

export function usePrds() {
  const { data: prds = [], isLoading, error } = useQuery({
    queryKey: queryKeys.prds.list(),
    queryFn: fetchPrds,
    // PRD는 자주 안 바뀜: staleTime 5분
    staleTime: 5 * 60_000,
  });

  return {
    prds,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "오류 발생") : null,
  };
}
