"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TaskFrontmatter } from "@/parser/parser";
import { buildWaterfallGroups } from "@/lib/waterfall";
import type { WaterfallGroup } from "@/types/waterfall";
import { queryKeys } from "@/lib/query-keys";
import { getErrorMessage } from "@/lib/error-utils";

type UseTasksResult = {
  groups: WaterfallGroup[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

async function fetchTasks(): Promise<WaterfallGroup[]> {
  const res = await fetch("/api/tasks");
  if (!res.ok) {
    throw new Error("데이터를 불러오는데 실패했습니다.");
  }
  const tasks: TaskFrontmatter[] = await res.json();
  return buildWaterfallGroups(tasks);
}

export function useTasks(): UseTasksResult {
  const queryClient = useQueryClient();

  const { data: groups = [], isLoading, error } = useQuery({
    queryKey: queryKeys.tasks.list(),
    queryFn: fetchTasks,
    staleTime: 5_000,
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });

  return {
    groups,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch,
  };
}
