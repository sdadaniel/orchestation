"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useEffect, useCallback, useState } from "react";
import { queryKeys } from "@/lib/query-keys";
import type { OrchestrationStatus, OrchestrationStatusData } from "@/lib/orchestration-manager";

export type { OrchestrationStatusData };

type UseOrchestrationStatusResult = {
  data: OrchestrationStatusData;
  isRunning: boolean;
  justFinished: boolean;
  clearFinished: () => void;
};

const DEFAULT_DATA: OrchestrationStatusData = {
  status: "idle",
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  taskResults: [],
};

async function fetchOrchestrationStatus(): Promise<OrchestrationStatusData> {
  const res = await fetch("/api/orchestrate/status");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useOrchestrationStatus(): UseOrchestrationStatusResult {
  const queryClient = useQueryClient();
  const prevStatusRef = useRef<OrchestrationStatus>("idle");
  const [justFinished, setJustFinished] = useState(false);

  const { data = DEFAULT_DATA } = useQuery({
    queryKey: queryKeys.orchestration.status(),
    queryFn: fetchOrchestrationStatus,
    // always fresh: staleTime 0
    staleTime: 0,
    // 조건부 polling: running이면 2s, idle이면 5s
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "running") return 2_000;
      return 5_000;
    },
    // 에러 시 조용히 처리
    retry: false,
  });

  // running → completed/failed 전환 감지
  useEffect(() => {
    const currentStatus = data.status;
    if (
      prevStatusRef.current === "running" &&
      (currentStatus === "completed" || currentStatus === "failed")
    ) {
      setJustFinished(true);
      // orchestration 완료 시 costs, run-history 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.costs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.runHistory.all });
    }
    prevStatusRef.current = currentStatus;
  }, [data.status, queryClient]);

  const clearFinished = useCallback(() => {
    setJustFinished(false);
  }, []);

  return {
    data,
    isRunning: data.status === "running",
    justFinished,
    clearFinished,
  };
}
