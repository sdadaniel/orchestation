"use client";

import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { usePlanTree } from "@/hooks/usePlanTree";
import { PlanTreeContainer } from "@/components/plan/PlanTreeContainer";
import { TaskDetailPanel } from "@/components/waterfall/TaskDetailPanel";
import { Skeleton } from "@/components/ui/skeleton";
import type { WaterfallTask } from "@/types/waterfall";

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-48" />
      {[1, 2].map((i) => (
        <div key={i} className="rounded-lg border bg-card">
          <div className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="h-2 w-24" />
          </div>
          <div className="flex flex-col gap-1 p-4">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-12 w-full rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-5 w-5" />
        <p>{message}</p>
      </div>
    </div>
  );
}

export default function PlanPage() {
  const { data, allTasks, loading, error } = usePlanTree();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const taskSprintMap = useMemo(() => {
    if (!data) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const sprint of data.sprints) {
      for (const task of sprint.tasks) {
        map.set(task.id, sprint.id);
      }
    }
    return map;
  }, [data]);

  const selectedTask: WaterfallTask | null = useMemo(() => {
    if (!selectedTaskId) return null;
    const task = allTasks.find((t) => t.id === selectedTaskId);
    if (!task) return null;
    return {
      id: task.id,
      title: task.title,
      status: task.status as WaterfallTask["status"],
      priority: task.priority,
      role: task.role,
      depends_on: task.depends_on,
      blocks: task.blocks,
      parallel_with: task.parallel_with,
      affected_files: task.affected_files,
      sprint: taskSprintMap.get(task.id) ?? "",
    };
  }, [selectedTaskId, allTasks, taskSprintMap]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">등록된 플랜이 없습니다.</p>
      </div>
    );
  }

  return (
    <>
      <PlanTreeContainer data={data} onTaskClick={setSelectedTaskId} />
      <TaskDetailPanel
        task={selectedTask}
        onClose={() => setSelectedTaskId(null)}
      />
    </>
  );
}
