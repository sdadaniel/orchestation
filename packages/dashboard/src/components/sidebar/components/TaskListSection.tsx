"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequestItem } from "@/store/tasksStore";

export interface TaskListSectionProps {
  requestItems: RequestItem[];
  currentPath: string;
  onStopTask?: (id: string) => Promise<void>;
}

export function TaskListSection({
  requestItems,
  currentPath,
  onStopTask,
}: TaskListSectionProps) {
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [stoppingTaskId, setStoppingTaskId] = useState<string | null>(null);

  const padDate = (d: string) => (d.length === 10 ? `${d} 99:99:99` : d);
  const statusWeight = (s: string) => {
    switch (s) {
      case "in_progress":
        return 0;
      case "reviewing":
        return 1;
      case "pending":
        return 2;
      case "stopped":
        return 3;
      default:
        return 4;
    }
  };

  const uniqueItems = [...new Map(requestItems.map((r) => [r.id, r])).values()];
  const recentItems = uniqueItems
    .sort((a, b) => {
      const sw = statusWeight(a.status) - statusWeight(b.status);
      if (sw !== 0) return sw;
      return padDate(b.updated ?? b.created).localeCompare(
        padDate(a.updated ?? a.created),
      );
    })
    .slice(0, 10);

  return (
    <div className="mb-2">
      <div className="sidebar-section-sep" />
      <div className="px-2 mb-1.5 flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setTasksExpanded((v) => !v)}
        >
          <ChevronDown
            className="h-3 w-3 transition-transform duration-200"
            style={{
              transform: tasksExpanded ? "rotate(0deg)" : "rotate(-90deg)",
            }}
          />
          <Link
            href="/tasks"
            className={cn(
              "no-underline text-muted-foreground hover:text-foreground transition-colors",
              currentPath.startsWith("/tasks") && "text-primary",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            Tasks
          </Link>
        </button>
        <span
          className={cn(
            "text-[10px] font-medium tabular-nums px-1 rounded",
            currentPath.startsWith("/tasks")
              ? "text-primary"
              : "text-muted-foreground",
          )}
        >
          {requestItems.length}
        </span>
      </div>

      <div
        className={cn(
          "sidebar-collapsible",
          tasksExpanded && "sidebar-collapsible-open",
        )}
      >
        <div className="sidebar-collapsible-inner">
          {recentItems.map((task) => {
            const taskDisplayId = task.id;
            const isDone = task.status === "done";
            const isInProgress = task.status === "in_progress";
            const statusIndicator = isInProgress ? (
              <span className="w-3 h-3 shrink-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : isDone ? (
              <span className="text-emerald-500 text-xs shrink-0">&#10003;</span>
            ) : task.status === "reviewing" ? (
              <span className="w-2 h-2 rounded-full shrink-0 bg-orange-500" />
            ) : task.status === "pending" ? (
              <span className="w-2 h-2 rounded-full shrink-0 bg-yellow-500" />
            ) : task.status === "stopped" ? (
              <span className="w-2 h-2 rounded-full shrink-0 bg-violet-500" />
            ) : (
              <span className="w-2 h-2 rounded-full shrink-0 bg-red-500" />
            );
            return (
              <div key={task.id} className="group relative">
                <Link
                  href={`/tasks/${taskDisplayId}`}
                  className={cn(
                    "tree-item w-full text-left no-underline",
                    isInProgress && "pr-7",
                    currentPath === `/tasks/${taskDisplayId}` && "active",
                  )}
                >
                  {statusIndicator}
                  <span
                    className={cn(
                      "truncate flex-1 text-xs",
                      isDone && "text-muted-foreground line-through",
                    )}
                  >
                    {taskDisplayId} {task.title}
                  </span>
                </Link>
                {isInProgress &&
                  onStopTask &&
                  (stoppingTaskId === task.id ? (
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-red-400">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      title="중지"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setStoppingTaskId(task.id);
                        try {
                          await onStopTask(task.id);
                        } finally {
                          setStoppingTaskId(null);
                        }
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Square className="h-2.5 w-2.5" />
                    </button>
                  ))}
              </div>
            );
          })}

          <Link
            href="/tasks/new"
            className={cn(
              "tree-item w-full text-left text-muted-foreground hover:text-foreground no-underline",
              currentPath === "/tasks/new" && "active",
            )}
          >
            <Plus className="h-3 w-3 shrink-0" />
            <span className="text-xs">New Task</span>
          </Link>

          {requestItems.length === 0 && (
            <div className="px-2 py-2 text-[11px] text-muted-foreground">
              No tasks yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
