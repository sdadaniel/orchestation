"use client";

import { useQuery } from "@tanstack/react-query";
import type { PlanFrontmatter } from "@/parser/plan-parser";
import type { TaskFrontmatter } from "@/parser/parser";
import { buildPlanTree } from "@/parser/plan-tree";
import type { PlanTreeData } from "@/types/plan";
import { queryKeys } from "@/lib/query-keys";
import { getErrorMessage } from "@/lib/error-utils";

type PlanTreeResult = {
  data: PlanTreeData | null;
  allTasks: TaskFrontmatter[];
};

type UsePlanTreeResult = {
  data: PlanTreeData | null;
  allTasks: TaskFrontmatter[];
  loading: boolean;
  error: string | null;
};

async function fetchPlanTree(): Promise<PlanTreeResult> {
  const [plansRes, tasksRes] = await Promise.all([
    fetch("/api/plans"),
    fetch("/api/tasks"),
  ]);

  if (!plansRes.ok || !tasksRes.ok) {
    throw new Error("데이터를 불러오는데 실패했습니다.");
  }

  const plans: PlanFrontmatter[] = await plansRes.json();
  const tasks: TaskFrontmatter[] = await tasksRes.json();

  const firstPlan = plans[0];
  return {
    data: firstPlan === undefined ? null : buildPlanTree(firstPlan, tasks),
    allTasks: tasks,
  };
}

export function usePlanTree(): UsePlanTreeResult {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.plans.list(),
    queryFn: fetchPlanTree,
    staleTime: 5_000,
  });

  return {
    data: data?.data ?? null,
    allTasks: data?.allTasks ?? [],
    loading: isLoading,
    error: error ? getErrorMessage(error) : null,
  };
}
