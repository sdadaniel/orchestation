"use client";

import { useEffect, useState } from "react";
import type { PlanFrontmatter } from "@/lib/plan-parser";
import type { SprintData } from "@/lib/sprint-parser";
import type { TaskFrontmatter } from "@/lib/parser";
import { buildPlanTree } from "@/lib/plan-tree";
import type { PlanTreeData } from "@/types/plan";

type UsePlanTreeResult = {
  data: PlanTreeData | null;
  allTasks: TaskFrontmatter[];
  loading: boolean;
  error: string | null;
};

export function usePlanTree(): UsePlanTreeResult {
  const [data, setData] = useState<PlanTreeData | null>(null);
  const [allTasks, setAllTasks] = useState<TaskFrontmatter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [plansRes, sprintsRes, tasksRes] = await Promise.all([
          fetch("/api/plans"),
          fetch("/api/sprints"),
          fetch("/api/tasks"),
        ]);

        if (!plansRes.ok || !sprintsRes.ok || !tasksRes.ok) {
          throw new Error("데이터를 불러오는데 실패했습니다.");
        }

        const plans: PlanFrontmatter[] = await plansRes.json();
        const sprints: SprintData[] = await sprintsRes.json();
        const tasks: TaskFrontmatter[] = await tasksRes.json();

        if (!cancelled) {
          if (plans.length === 0) {
            setData(null);
          } else {
            setData(buildPlanTree(plans[0], sprints, tasks));
          }
          setAllTasks(tasks);
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
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, allTasks, loading, error };
}
