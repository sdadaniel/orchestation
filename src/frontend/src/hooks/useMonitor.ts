"use client";

import { useQuery } from "@tanstack/react-query";
import { useRef, useEffect, useState } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { ClaudeProcess } from "@/lib/monitor-types";
import { getErrorMessage } from "@/lib/error-utils";

export type { ClaudeProcess };

export interface MonitorSnapshot {
  cpu: { user: number; system: number; idle: number };
  loadAvg: { "1m": number; "5m": number; "15m": number };
  memory: { total: number; free: number; used: number; usedPercent: number };
  processCount: number;
  threadCount: number;
  cpuCores: number;
  claudeProcesses: ClaudeProcess[];
  timestamp: number;
}

export interface MonitorData {
  current: MonitorSnapshot | null;
  history: MonitorSnapshot[];
}

const MAX_HISTORY = 60; // 60초

async function fetchMonitor(): Promise<MonitorSnapshot> {
  const res = await fetch("/api/monitor");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useMonitor(intervalMs = 10000): MonitorData & { error: string | null } {
  // history는 React Query 외부에서 누적 관리 (캐시에 snapshot 1개만 저장)
  const historyRef = useRef<MonitorSnapshot[]>([]);
  const [history, setHistory] = useState<MonitorSnapshot[]>([]);

  // 페이지가 보일 때만 폴링 (탭 전환/최소화 시 중단)
  const [isVisible, setIsVisible] = useState(true);
  useEffect(() => {
    const handler = () => setIsVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const { data: current = null, error } = useQuery({
    queryKey: queryKeys.monitor.current() as QueryKey,
    queryFn: fetchMonitor,
    staleTime: 5000,
    refetchInterval: isVisible ? intervalMs : false,
    enabled: isVisible,
    retry: false,
  });

  // 최신 snapshot이 바뀔 때마다 history 누적
  useEffect(() => {
    if (!current) return;
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), current];
    setHistory(historyRef.current);
  }, [current]);

  return {
    current,
    history,
    error: error ? getErrorMessage(error) : null,
  };
}
