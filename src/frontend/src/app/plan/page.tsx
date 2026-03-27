"use client";

import { useState, useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { usePlanTree } from "@/hooks/usePlanTree";
import { PlanTreeContainer } from "@/components/plan/PlanTreeContainer";
import { TaskDetailPanel } from "@/components/waterfall/TaskDetailPanel";
import { Skeleton } from "@/components/ui/skeleton";
import type { WaterfallTask } from "@/types/waterfall";

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-36" />
      {[1, 2].map((i) => (
        <div key={i} className="border-b border-border pb-2">
          <div className="flex items-center gap-2 px-2 py-2">
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="ml-auto h-1 w-16" />
          </div>
          <div className="flex flex-col gap-0.5 pl-5">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-7 w-full rounded" />
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
        <AlertCircle className="h-4 w-4" />
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}

export default function PlanPage() {
  const { data, allTasks, loading, error } = usePlanTree();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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
    };
  }, [selectedTaskId, allTasks]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!data) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-muted-foreground">No plan registered.</p>
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
