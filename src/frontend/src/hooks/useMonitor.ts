"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export interface MonitorSnapshot {
  cpu: { user: number; system: number; idle: number };
  loadAvg: { "1m": number; "5m": number; "15m": number };
  memory: { total: number; free: number; used: number; usedPercent: number };
  processCount: number;
  threadCount: number;
  cpuCores: number;
  timestamp: number;
}

export interface MonitorData {
  current: MonitorSnapshot | null;
  history: MonitorSnapshot[];
}

const MAX_HISTORY = 60; // 60초

export function useMonitor(intervalMs = 1000): MonitorData & { error: string | null } {
  const [current, setCurrent] = useState<MonitorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<MonitorSnapshot[]>([]);
  const [history, setHistory] = useState<MonitorSnapshot[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/monitor");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MonitorSnapshot = await res.json();
      setCurrent(data);
      setError(null);

      historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), data];
      setHistory(historyRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => clearInterval(id);
  }, [fetchData, intervalMs]);

  return { current, history, error };
}
