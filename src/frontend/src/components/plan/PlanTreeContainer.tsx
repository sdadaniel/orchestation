"use client";

import { useRouter } from "next/navigation";
import type { PlanTreeData, PlanTaskNode } from "@/types/plan";
import { SprintProgress } from "@/components/waterfall/SprintProgress";
import { cn } from "@/lib/utils";
import {
  STATUS_STYLES,
  PRIORITY_STYLES,
  type TaskStatus,
  type TaskPriority,
} from "../../../lib/constants";

type PlanTreeContainerProps = {
  data: PlanTreeData;
  onTaskClick: (taskId: string) => void;
};

function PlanTaskBar({
  task,
  onClick,
}: {
  task: PlanTaskNode;
  onClick: (taskId: string) => void;
}) {
  const statusStyle = STATUS_STYLES[task.status as TaskStatus];
  const priorityStyle =
    PRIORITY_STYLES[task.priority as TaskPriority] ?? PRIORITY_STYLES.medium;

  return (
    <button
      type="button"
      onClick={() => onClick(task.id)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-white transition-colors",
        statusStyle?.bg ?? "bg-muted",
        "hover:brightness-110 hover:shadow-md",
        "cursor-pointer",
      )}
    >
      <span className="shrink-0 font-mono text-xs opacity-80">{task.id}</span>
      <span className="truncate font-medium">{task.title}</span>
      <span
        className={cn(
          "ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
          priorityStyle.bg,
          priorityStyle.text,
        )}
      >
        {priorityStyle.label}
      </span>
    </button>
  );
}

export function PlanTreeContainer({ data, onTaskClick }: PlanTreeContainerProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">{data.plan.title}</h2>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {data.plan.status}
        </span>
      </div>

      {data.sprints.map((sprint) => (
        <SprintProgress
          key={sprint.id}
          title={sprint.title}
          done={sprint.progress.done}
          total={sprint.progress.total}
        >
          <div className="flex flex-col gap-1 p-4">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mb-2 self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              워터폴 뷰에서 보기 &rarr;
            </button>
            {sprint.tasks.length > 0 ? (
              sprint.tasks.map((task) => (
                <PlanTaskBar
                  key={task.id}
                  task={task}
                  onClick={onTaskClick}
                />
              ))
            ) : (
              <p className="py-2 text-sm text-muted-foreground">
                배정된 태스크가 없습니다
              </p>
            )}
          </div>
        </SprintProgress>
      ))}
    </div>
  );
}
