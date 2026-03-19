"use client";

import { useEffect, useState } from "react";
import type { TaskFrontmatter } from "@/lib/parser";
import type { SprintResponse } from "@/lib/waterfall";
import { buildWaterfallGroups } from "@/lib/waterfall";
import type { WaterfallGroup } from "@/types/waterfall";

type UseTasksResult = {
  groups: WaterfallGroup[];
  isLoading: boolean;
  error: string | null;
};

export function useTasks(): UseTasksResult {
  const [groups, setGroups] = useState<WaterfallGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
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
            err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
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
  }, []);

  return { groups, isLoading, error };
}
