"use client";

import { useState } from "react";
import type { WaterfallGroup, WaterfallTask } from "@/types/waterfall";
import { SprintHeader } from "./SprintHeader";
import { TaskBar } from "./TaskBar";
import { TaskDetailPanel } from "./TaskDetailPanel";

type WaterfallContainerProps = {
  groups: WaterfallGroup[];
};

export function WaterfallContainer({ groups }: WaterfallContainerProps) {
  const [selectedTask, setSelectedTask] = useState<WaterfallTask | null>(null);

  return (
    <>
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <section key={group.sprint.id} className="rounded-lg border bg-card">
            <SprintHeader sprint={group.sprint} progress={group.progress} />
            <div className="flex flex-col gap-1 p-4">
              {group.tasks.length > 0 ? (
                group.tasks.map((task) => (
                  <TaskBar
                    key={task.id}
                    task={task}
                    onClick={setSelectedTask}
                  />
                ))
              ) : (
                <p className="py-2 text-sm text-muted-foreground">
                  배정된 태스크가 없습니다
                </p>
              )}
            </div>
          </section>
        ))}
      </div>

      <TaskDetailPanel
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </>
  );
}
