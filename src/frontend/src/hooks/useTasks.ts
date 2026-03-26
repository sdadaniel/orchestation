"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TaskFrontmatter } from "@/lib/parser";
import type { SprintResponse } from "@/lib/waterfall";
import { buildWaterfallGroups } from "@/lib/waterfall";
import type { WaterfallGroup } from "@/types/waterfall";
import { queryKeys } from "@/lib/query-keys";
import { useSSEWatch } from "@/hooks/useSSEWatch";
import { getErrorMessage } from "@/lib/error-utils";

type UseTasksResult = {
  groups: WaterfallGroup[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

async function fetchTasksAndSprints(): Promise<WaterfallGroup[]> {
  const [tasksRes, sprintsRes] = await Promise.all([
    fetch("/api/tasks"),
    fetch("/api/sprints"),
  ]);

  if (!tasksRes.ok || !sprintsRes.ok) {
    throw new Error("데이터를 불러오는데 실패했습니다.");
  }

  const tasks: TaskFrontmatter[] = await tasksRes.json();
  const sprints: SprintResponse[] = await sprintsRes.json();

  return buildWaterfallGroups(tasks, sprints);
}

export function useTasks(): UseTasksResult {
  const queryClient = useQueryClient();

  const { data: groups = [], isLoading, error } = useQuery({
    queryKey: queryKeys.tasks.list(),
    queryFn: fetchTasksAndSprints,
    staleTime: 5_000,
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });

  useSSEWatch("/api/tasks/watch", refetch);

  return {
    groups,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch,
  };
}
