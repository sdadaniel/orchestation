"use client";

import { useState, useMemo } from "react";
import { usePlanTree } from "@/hooks/usePlanTree";
import { PlanTreeContainer } from "@/components/Plan/PlanTreeContainer";
import { TaskDetailPanel } from "@/components/Waterfall/TaskDetailPanel";
import type { WaterfallTask } from "@/types/waterfall";
import { ErrorState, LoadingSkeleton } from "./components";

export default function PlanPageView() {
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
      scope: task.scope,
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
