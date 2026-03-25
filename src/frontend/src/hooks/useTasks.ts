"use client";

import { useEffect, useState, useCallback } from "react";
import type { TaskFrontmatter } from "@/lib/parser";
import type { SprintResponse } from "@/lib/waterfall";
import { buildWaterfallGroups } from "@/lib/waterfall";
import type { WaterfallGroup } from "@/types/waterfall";

type UseTasksResult = {
  groups: WaterfallGroup[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useTasks(): UseTasksResult {
  const [groups, setGroups] = useState<WaterfallGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setIsLoading(true);
        const [tasksRes, sprintsRes] = await Promise.all([
          fetch("/api/tasks"),
          fetch("/api/sprints"),
        ]);

        if (!tasksRes.ok || !sprintsRes.ok) {
          throw new Error("데이터를 불러오는데 실패했습니다.");
        }

        const tasks: TaskFrontmatter[] = await tasksRes.json();
        const sprints: SprintResponse[] = await sprintsRes.json();

        if (!cancelled) {
          setGroups(buildWaterfallGroups(tasks, sprints));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "알 수 없는 오류가 발생했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [fetchKey]);

  // SSE: task 파일 변경 시 디바운스 후 갱신
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => refetch(), 1000);
    };

    const connect = () => {
      es = new EventSource("/api/tasks/watch");
      es.onmessage = (e) => {
        if (e.data === "changed") debouncedRefetch();
      };
      es.onerror = () => {
        es?.close();
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [refetch]);

  return { groups, isLoading, error, refetch };
}
