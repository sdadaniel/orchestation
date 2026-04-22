"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { TaskDetail, STATUS_DOT } from "./types";

interface DependencyFlowProps {
  task: TaskDetail;
}

export function DependencyFlow({ task }: DependencyFlowProps) {
  const router = useRouter();

  const hasUpstream = (task.depends_on_detail?.length ?? 0) > 0;
  const hasDownstream = (task.depended_by?.length ?? 0) > 0;

  if (!hasUpstream && !hasDownstream) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Dependency Flow
      </h2>
      <div
        className="flex items-center gap-0 overflow-x-auto pb-2 scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {task.depends_on_detail?.map((dep) => (
          <div
            key={dep.id}
            className="flex items-center gap-0 w-1/3 shrink-0 min-w-[180px]"
          >
            <button
              type="button"
              onClick={() => router.push(`/tasks/${dep.id}`)}
              className="flex flex-col gap-1 px-2.5 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors flex-1 min-w-0"
            >
              <div className="flex items-center gap-1.5">
                {dep.status === "in_progress" ? (
                  <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      STATUS_DOT[dep.status] || "bg-gray-400",
                    )}
                  />
                )}
                <span className="font-mono text-[10px] text-muted-foreground">
                  {dep.id}
                </span>
              </div>
              <span className="text-[11px] leading-tight truncate">
                {dep.title}
              </span>
            </button>
            <span className="text-muted-foreground mx-1.5 text-sm shrink-0">
              &rarr;
            </span>
          </div>
        ))}
        <div className="flex flex-col gap-1 px-2.5 py-2 rounded-lg border-2 border-primary bg-primary/5 w-1/3 shrink-0 min-w-[180px]">
          <div className="flex items-center gap-1.5">
            {task.status === "in_progress" ? (
              <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  STATUS_DOT[task.status] || "bg-gray-400",
                )}
              />
            )}
            <span className="font-mono text-[10px] font-semibold">
              {task.id}
            </span>
          </div>
          <span className="text-[11px] leading-tight font-medium truncate">
            {task.title}
          </span>
        </div>
        {task.depended_by?.map((dep) => (
          <div
            key={dep.id}
            className="flex items-center gap-0 w-1/3 shrink-0 min-w-[180px]"
          >
            <span className="text-muted-foreground mx-1.5 text-sm shrink-0">
              &rarr;
            </span>
            <button
              type="button"
              onClick={() => router.push(`/tasks/${dep.id}`)}
              className="flex flex-col gap-1 px-2.5 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors flex-1 min-w-0"
            >
              <div className="flex items-center gap-1.5">
                {dep.status === "in_progress" ? (
                  <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      STATUS_DOT[dep.status] || "bg-gray-400",
                    )}
                  />
                )}
                <span className="font-mono text-[10px] text-muted-foreground">
                  {dep.id}
                </span>
              </div>
              <span className="text-[11px] leading-tight truncate">
                {dep.title}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
