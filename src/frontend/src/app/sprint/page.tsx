"use client";

import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useSprints } from "@/hooks/useSprints";
import { useSprintDetail } from "@/hooks/useSprintDetail";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  STATUS_STYLES,
  PRIORITY_STYLES,
  type TaskStatus,
  type TaskPriority,
} from "../../../lib/constants";

const SPRINT_STATUS_DOT: Record<string, string> = {
  ready: "bg-zinc-400",
  in_progress: "bg-blue-500",
  done: "bg-emerald-500",
};

/* ── Sprint Detail Inline ── */

function SprintInlineDetail({ sprintId }: { sprintId: string }) {
  const { sprint, isLoading } = useSprintDetail(sprintId);
  const [tab, setTab] = useState<"list" | "board">("list");

  if (isLoading) {
    return (
      <div className="p-3">
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!sprint) return null;

  const allTasks = sprint.batches.flatMap((b) => b.tasks);

  return (
    <div className="border-t border-border">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-muted/30">
        <button
          type="button"
          className={cn("filter-pill", tab === "list" && "active")}
          onClick={() => setTab("list")}
        >
          목록
        </button>
        <button
          type="button"
          className={cn("filter-pill", tab === "board" && "active")}
          onClick={() => setTab("board")}
        >
          보드
        </button>
        <span className="ml-auto text-xs text-muted-foreground">
          {allTasks.length} tasks
        </span>
      </div>

      {tab === "list" ? (
        /* 목록 뷰 */
        <div>
          {sprint.batches.map((batch) => (
            <div key={batch.name}>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/20 border-b border-border">
                {batch.name}
              </div>
              {batch.tasks.map((task) => {
                const statusStyle = STATUS_STYLES[task.status as TaskStatus];
                const priorityStyle = PRIORITY_STYLES[task.priority as TaskPriority] ?? PRIORITY_STYLES.medium;
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 px-3 py-1.5 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusStyle?.dot ?? "bg-gray-400")} />
                    <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">{task.id}</span>
                    <span className="text-sm flex-1 truncate">{task.title}</span>
                    <span className={cn("text-xs rounded px-1.5 py-0.5 shrink-0", priorityStyle.bg, priorityStyle.text)}>
                      {priorityStyle.label}
                    </span>
                    <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                      {statusStyle?.label ?? task.status}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        /* 보드 뷰 */
        <div className="p-3">
          <div className="board-container">
            {(["pending", "in_progress", "in_review", "done"] as TaskStatus[]).map((status) => {
              const style = STATUS_STYLES[status];
              const tasks = allTasks.filter((t) => t.status === status);
              const colColor = status === "pending" ? "board-col-gray" :
                status === "in_progress" ? "board-col-blue" :
                status === "in_review" ? "board-col-orange" : "board-col-green";
              return (
                <div key={status} className="board-column">
                  <div className={cn("board-column-header", colColor)}>
                    <span>{style.label}</span>
                    <span className="board-column-count">{tasks.length}</span>
                  </div>
                  <div className="board-column-body">
                    {tasks.length === 0 ? (
                      <div className="text-[10px] text-muted-foreground text-center py-3">No tasks</div>
                    ) : (
                      tasks.map((task) => {
                        const ps = PRIORITY_STYLES[task.priority as TaskPriority] ?? PRIORITY_STYLES.medium;
                        return (
                          <div key={task.id} className="board-card">
                            <div className="flex items-center gap-1.5">
                              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
                              <span className="font-mono text-[10px] text-muted-foreground">{task.id}</span>
                            </div>
                            <span className="text-xs mt-0.5 truncate">{task.title}</span>
                            <span className={cn("text-[9px] mt-1 self-start rounded px-1 py-0.5", ps.bg, ps.text)}>
                              {ps.label}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */

function LoadingSkeleton() {
  return (
    <div className="flex flex-col">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-border">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="ml-auto h-1 w-16" />
        </div>
      ))}
    </div>
  );
}

export default function SprintListPage() {
  const { sprints, isLoading, error } = useSprints();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <div className="p-4 text-sm text-destructive">{error}</div>;
  if (sprints.length === 0) return <div className="p-4 text-xs text-muted-foreground">No sprints</div>;

  return (
    <div className="flex flex-col">
      {sprints.map((sprint) => {
        const percentage = sprint.progress.total > 0
          ? Math.round((sprint.progress.done / sprint.progress.total) * 100)
          : 0;
        const isExpanded = expandedId === sprint.id;
        const dotColor = SPRINT_STATUS_DOT[sprint.status] ?? "bg-gray-400";

        return (
          <div key={sprint.id} className={cn("border-b border-border", isExpanded && "bg-card")}>
            {/* Sprint 행 — 클릭으로 아코디언 토글 */}
            <button
              type="button"
              className="flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              onClick={() => setExpandedId(isExpanded ? null : sprint.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
              <span className="text-sm font-medium flex-1 truncate">{sprint.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {sprint.progress.done}/{sprint.progress.total}
              </span>
              <Progress value={percentage} className="h-1.5 w-20 shrink-0" />
              <span className="text-xs text-muted-foreground w-16 text-right capitalize shrink-0">
                {sprint.status.replace("_", " ")}
              </span>
            </button>

            {/* 아코디언: 상세 (목록/보드) */}
            {isExpanded && <SprintInlineDetail sprintId={sprint.id} />}
          </div>
        );
      })}
    </div>
  );
}
