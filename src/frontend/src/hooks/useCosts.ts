"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CostData } from "@/parser/cost-parser";
import { queryKeys } from "@/lib/query-keys";
import { getErrorMessage } from "@/lib/error-utils";

type UseCostsResult = {
  data: CostData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

async function fetchCosts(): Promise<CostData> {
  const res = await fetch("/api/costs");
  if (!res.ok) throw new Error("비용 데이터를 불러오는데 실패했습니다.");
  return res.json();
}

export function useCosts(): UseCostsResult {
  const queryClient = useQueryClient();

  const { data = null, isLoading, error } = useQuery({
    queryKey: queryKeys.costs.list(),
    queryFn: fetchCosts,
    // 비용 데이터: staleTime 60s
    staleTime: 60_000,
  });

  return {
    data,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch: () => queryClient.invalidateQueries({ queryKey: queryKeys.costs.all }),
  };
}
