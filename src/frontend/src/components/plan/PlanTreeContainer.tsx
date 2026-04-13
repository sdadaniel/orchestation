"use client";

import type { PlanTreeData, PlanTaskNode } from "@/types/plan";
import { cn } from "@/lib/utils";
import { STATUS_STYLES, PRIORITY_STYLES } from "@/constants/theme";

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
  const statusStyle = STATUS_STYLES[task.status];
  const priorityStyle =
    PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium;

  return (
    <button
      type="button"
      onClick={() => onClick(task.id)}
      className={cn(
        "group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors",
        "hover:bg-muted/80 cursor-pointer border-b border-transparent hover:border-border",
      )}
    >
      <span className={cn("status-dot", statusStyle?.dot ?? "bg-gray-400")} />
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground w-20 truncate">
        {task.id}
      </span>
      <span className="truncate text-sm">{task.title}</span>
      <span
        className={cn(
          "ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
          priorityStyle.bg,
          priorityStyle.text,
        )}
      >
        {priorityStyle.label}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground w-16 text-right">
        {statusStyle?.label ?? task.status}
      </span>
      <span className="hover-actions text-[10px] text-primary cursor-pointer">
        View
      </span>
    </button>
  );
}

export function PlanTreeContainer({
  data,
  onTaskClick,
}: PlanTreeContainerProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 pb-2 border-b border-border mb-1">
        <h2 className="text-sm font-semibold">{data.plan.title}</h2>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {data.plan.status}
        </span>
      </div>

      <div className="flex flex-col py-0.5">
        {data.tasks.length > 0 ? (
          data.tasks.map((task) => (
            <PlanTaskBar key={task.id} task={task} onClick={onTaskClick} />
          ))
        ) : (
          <p className="py-1 px-2 text-xs text-muted-foreground">No tasks</p>
        )}
      </div>
    </div>
  );
}
