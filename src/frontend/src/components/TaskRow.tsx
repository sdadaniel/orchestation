"use client";

import { cn } from "@/lib/utils";
import { PriorityBadge } from "@/components/ui/badge";
import {
  STATUS_STYLES,
  type TaskStatus,
  type TaskPriority,
} from "../../lib/constants";
import type { WaterfallTask } from "@/types/waterfall";

type TaskRowProps = {
  task: WaterfallTask;
  isSelected: boolean;
  onClick: (task: WaterfallTask) => void;
};

export function TaskRow({ task, isSelected, onClick }: TaskRowProps) {
  const statusStyle = STATUS_STYLES[task.status as TaskStatus];

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn("task-row", isSelected && "selected")}
      onClick={() => onClick(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(task);
        }
      }}
    >
      {/* Status dot */}
      <span className={cn("status-dot", statusStyle.dot)} />

      {/* Task ID */}
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground w-[72px] truncate">
        {task.id}
      </span>

      {/* Title */}
      <span className="flex-1 truncate text-[12px]">{task.title}</span>

      {/* Priority badge */}
      <PriorityBadge
        priority={task.priority as TaskPriority}
        className="shrink-0 leading-[18px]"
      />

      {/* Role */}
      <span className="shrink-0 text-[11px] text-muted-foreground w-16 truncate text-right">
        {task.role}
      </span>

      {/* Hover actions */}
      <span className="row-actions flex items-center gap-1 shrink-0">
        <span className="rounded px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/10 cursor-pointer">
          View
        </span>
      </span>
    </div>
  );
}
