"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TaskFrontmatter } from "@/parser/parser";
import { buildWaterfallGroups } from "@/lib/waterfall";
import type { WaterfallGroup } from "@/types/waterfall";
import { queryKeys } from "@/lib/query/query-keys";
import { getErrorMessage } from "@/lib/errors/error-utils";
import { fetchTaskGraphItems } from "@/lib/task-graph-fetch";
import type { TaskGraphItem } from "@/types/task-graph";

type UseTasksSelected = {
  groups: WaterfallGroup[];
  tasks: TaskGraphItem[];
};

export type UseTasksResult = {
  groups: WaterfallGroup[];
  tasks: TaskGraphItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useTasks(enabled = true): UseTasksResult {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.tasks.graph(),
    queryFn: fetchTaskGraphItems,
    staleTime: 5_000,
    enabled,
    select: (items): UseTasksSelected => ({
      groups: buildWaterfallGroups(items as TaskFrontmatter[]),
      tasks: items,
    }),
  });

  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });

  return {
    groups: data?.groups ?? [],
    tasks: data?.tasks ?? [],
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch,
  };
}
