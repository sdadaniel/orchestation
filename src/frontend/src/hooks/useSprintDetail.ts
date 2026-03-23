"use client";

import { useEffect, useState, useCallback } from "react";
import type { SprintData } from "@/lib/sprint-parser";
import type { TaskFrontmatter } from "@/lib/parser";

export type SprintDetailTask = TaskFrontmatter & {
  batch: string;
};

export type SprintDetail = {
  id: string;
  title: string;
  status: string;
  progress: { done: number; total: number };
  batches: { name: string; tasks: SprintDetailTask[] }[];
};

type UseSprintDetailResult = {
  sprint: SprintDetail | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
  refetch: () => void;
};

export function useSprintDetail(id: string): UseSprintDetailResult {
  const [sprint, setSprint] = useState<SprintDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setIsLoading(true);
        setNotFound(false);
        const [sprintsRes, tasksRes] = await Promise.all([
          fetch("/api/sprints"),
          fetch("/api/tasks"),
        ]);

        if (!sprintsRes.ok || !tasksRes.ok) {
          throw new Error("데이터를 불러오는데 실패했습니다.");
        }

        const sprintData: SprintData[] = await sprintsRes.json();
        const tasks: TaskFrontmatter[] = await tasksRes.json();

        const target = sprintData.find((s) => s.id === id);
        if (!target) {
          if (!cancelled) {
            setNotFound(true);
          }
          return;
        }

        const taskMap = new Map<string, TaskFrontmatter>();
        for (const task of tasks) {
          taskMap.set(task.id, task);
        }

        const total = target.tasks.length;
        const done = target.tasks.filter(
          (tid) => taskMap.get(tid)?.status === "done",
        ).length;

        const batches = target.batches.map((batch) => ({
          name: batch.name,
          tasks: batch.tasks
            .map((tid) => {
              const task = taskMap.get(tid);
              if (!task) return null;
              return { ...task, batch: batch.name };
            })
            .filter((t): t is SprintDetailTask => t !== null),
        }));

        if (!cancelled) {
          setSprint({
            id: target.id,
            title: `${target.id}: ${target.title}`,
            status: target.status,
            progress: { done, total },
            batches,
          });
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
  }, [id, fetchKey]);

  return { sprint, isLoading, error, notFound, refetch };
}
