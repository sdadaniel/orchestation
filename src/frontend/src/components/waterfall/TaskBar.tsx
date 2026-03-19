"use client";

import { cn } from "@/lib/utils";
import {
  STATUS_STYLES,
  PRIORITY_STYLES,
  type TaskStatus,
  type TaskPriority,
} from "../../../lib/constants";
import type { WaterfallTask } from "@/types/waterfall";

type TaskBarProps = {
  task: WaterfallTask;
  onClick?: (task: WaterfallTask) => void;
};

export function TaskBar({ task, onClick }: TaskBarProps) {
  const statusStyle = STATUS_STYLES[task.status as TaskStatus];
  const priorityStyle =
    PRIORITY_STYLES[task.priority as TaskPriority] ?? PRIORITY_STYLES.medium;

  return (
    <button
      type="button"
      onClick={() => onClick?.(task)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-white transition-colors",
        statusStyle.bg,
        "hover:brightness-110 hover:shadow-md",
        "cursor-pointer"
      )}
    >
      <span className="shrink-0 font-mono text-xs opacity-80">{task.id}</span>
      <span className="truncate font-medium">{task.title}</span>
      <span
        className={cn(
          "ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
          priorityStyle.bg,
          priorityStyle.text
        )}
      >
        {priorityStyle.label}
      </span>
      <span className="shrink-0 rounded-md bg-white/20 px-1.5 py-0.5 text-xs">
        {task.role}
      </span>
    </button>
  );
}
