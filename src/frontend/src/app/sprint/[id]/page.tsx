"use client";

import { use, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, FileQuestion } from "lucide-react";
import { useSprintDetail } from "@/hooks/useSprintDetail";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  STATUS_STYLES,
  PRIORITY_STYLES,
  type TaskStatus,
  type TaskPriority,
} from "../../../../lib/constants";
import type { SprintDetail, SprintDetailTask } from "@/hooks/useSprintDetail";

type TabKey = "list" | "board" | "timeline";

const TABS: { key: TabKey; label: string }[] = [
  { key: "list", label: "목록" },
  { key: "board", label: "보드" },
  { key: "timeline", label: "타임라인" },
];

/* ── Board View ─────────────────────────────────────────── */

const BOARD_COLUMNS: { status: TaskStatus; label: string; headerColor: string }[] = [
  { status: "backlog", label: "Backlog", headerColor: "board-col-gray" },
  { status: "in_progress", label: "In Progress", headerColor: "board-col-blue" },
  { status: "in_review", label: "In Review", headerColor: "board-col-orange" },
  { status: "done", label: "Done", headerColor: "board-col-green" },
];

function BoardView({
  sprint,
  onSelectTask,
}: {
  sprint: SprintDetail;
  onSelectTask: (t: SprintDetailTask) => void;
}) {
  const allTasks = sprint.batches.flatMap((b) => b.tasks);

  const grouped: Record<string, SprintDetailTask[]> = {
    backlog: [],
    in_progress: [],
    in_review: [],
    done: [],
  };

  for (const task of allTasks) {
    const bucket = grouped[task.status];
    if (bucket) {
      bucket.push(task);
    } else {
      grouped.backlog.push(task);
    }
  }

  return (
    <div className="board-container">
      {BOARD_COLUMNS.map((col) => {
        const tasks = grouped[col.status] ?? [];
        return (
          <div key={col.status} className="board-column">
            <div className={cn("board-column-header", col.headerColor)}>
              <span>{col.label}</span>
              <span className="board-column-count">{tasks.length}</span>
            </div>
            <div className="board-column-body">
              {tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No tasks</p>
              ) : (
                tasks.map((task) => {
                  const statusStyle = STATUS_STYLES[task.status as TaskStatus];
                  const priorityStyle =
                    PRIORITY_STYLES[task.priority as TaskPriority] ?? PRIORITY_STYLES.medium;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onSelectTask(task)}
                      className="board-card"
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn("status-dot", statusStyle?.dot ?? "bg-gray-400")} />
                        <span className="font-mono text-[10px] text-muted-foreground">{task.id}</span>
                      </div>
                      <span className="text-xs leading-tight truncate block">{task.title}</span>
                      <span
                        className={cn(
                          "inline-flex self-start items-center rounded px-1.5 py-0.5 text-[9px] font-semibold mt-1",
                          priorityStyle.bg,
                          priorityStyle.text,
                        )}
                      >
                        {priorityStyle.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Timeline View ──────────────────────────────────────── */

function TimelineView({
  sprint,
  onSelectTask,
}: {
  sprint: SprintDetail;
  onSelectTask: (t: SprintDetailTask) => void;
}) {
  const batches = sprint.batches;
  const allTasks = batches.flatMap((b) => b.tasks);

  // Map task id -> batch index
  const taskBatchIndex = new Map<string, number>();
  batches.forEach((batch, idx) => {
    for (const task of batch.tasks) {
      taskBatchIndex.set(task.id, idx);
    }
  });

  return (
    <div className="timeline-wrapper">
      {/* Header row with batch labels */}
      <div className="timeline-row timeline-header-row">
        <div className="timeline-task-label timeline-corner">Task</div>
        <div className="timeline-bars">
          {batches.map((batch, idx) => (
            <div key={idx} className="batch-column">
              <span className="text-[10px] text-muted-foreground font-medium truncate px-1">
                {batch.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Task rows */}
      {allTasks.map((task) => {
        const batchIdx = taskBatchIndex.get(task.id) ?? 0;
        const statusStyle = STATUS_STYLES[task.status as TaskStatus];
        const barBg = statusStyle?.bg ?? "bg-gray-400";

        // Find dependency arrows (only within this sprint)
        const deps = task.depends_on.filter((depId) => taskBatchIndex.has(depId));

        return (
          <div key={task.id} className="timeline-row">
            <button
              type="button"
              className="timeline-task-label"
              onClick={() => onSelectTask(task)}
            >
              <span className="font-mono text-[10px] text-muted-foreground shrink-0">{task.id}</span>
              <span className="text-xs truncate">{task.title}</span>
            </button>
            <div className="timeline-bars">
              {batches.map((_, colIdx) => (
                <div key={colIdx} className="batch-column">
                  {colIdx === batchIdx && (
                    <div className={cn("timeline-bar", barBg)} title={task.title}>
                      {deps.map((depId) => {
                        const depBatchIdx = taskBatchIndex.get(depId) ?? 0;
                        if (depBatchIdx < batchIdx) {
                          return (
                            <div
                              key={depId}
                              className="timeline-dep-arrow"
                              title={`depends on ${depId}`}
                            />
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── List View (extracted from original) ────────────────── */

function ListView({
  sprint,
  onSelectTask,
}: {
  sprint: SprintDetail;
  onSelectTask: (t: SprintDetailTask) => void;
}) {
  return (
    <>
      {/* Table header for tasks */}
      <div className="flex items-center gap-2 px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        <span className="w-2" />
        <span className="w-20">ID</span>
        <span className="flex-1">Title</span>
        <span className="w-16 text-right">Status</span>
      </div>

      {/* Batches */}
      <div className="flex flex-col">
        {sprint.batches.map((batch) => (
          <section key={batch.name}>
            <h2 className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground bg-muted/30 border-b border-border">
              {batch.name}
            </h2>
            <div className="flex flex-col">
              {batch.tasks.map((task) => {
                const statusStyle = STATUS_STYLES[task.status as TaskStatus];
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onSelectTask(task)}
                    className="group flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-muted/50 border-b border-border last:border-b-0"
                  >
                    <span className={cn("status-dot", statusStyle?.dot ?? "bg-gray-400")} />
                    <span className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground truncate">
                      {task.id}
                    </span>
                    <span className="flex-1 truncate text-sm">{task.title}</span>
                    <span className="w-16 text-right text-[10px] text-muted-foreground">
                      {statusStyle?.label ?? task.status}
                    </span>
                    <span className="hover-actions text-[10px] text-primary cursor-pointer">
                      View
                    </span>
                  </button>
                );
              })}
              {batch.tasks.length === 0 && (
                <p className="px-2 py-1 text-xs text-muted-foreground">
                  No tasks in batch.
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

const SPRINT_STATUS_DOT: Record<string, string> = {
  ready: "bg-zinc-400",
  in_progress: "bg-blue-500",
  done: "bg-emerald-500",
};

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-1 w-full max-w-xs" />
      {[1, 2].map((i) => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-3 w-32" />
          {[1, 2, 3].map((j) => (
            <Skeleton key={j} className="h-7 w-full rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="py-8 text-center">
      <FileQuestion className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
      <p className="text-xs text-muted-foreground mb-2">Sprint not found.</p>
      <Link
        href="/sprint"
        className="text-xs text-primary underline underline-offset-4"
      >
        Back to sprints
      </Link>
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

function TaskDetailSheet({
  task,
  onClose,
}: {
  task: SprintDetailTask | null;
  onClose: () => void;
}) {
  const open = task !== null;
  const statusStyle = task
    ? STATUS_STYLES[task.status as TaskStatus]
    : undefined;
  const priorityStyle = task
    ? (PRIORITY_STYLES[task.priority as TaskPriority] ?? PRIORITY_STYLES.medium)
    : undefined;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="overflow-y-auto">
        {task && (
          <>
            <SheetHeader>
              <SheetDescription className="font-mono text-xs">
                {task.id}
              </SheetDescription>
              <SheetTitle>{task.title}</SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-3 px-4 pb-4">
              <div className="flex flex-wrap gap-1.5">
                {statusStyle && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold text-white",
                      statusStyle.bg,
                    )}
                  >
                    {statusStyle.label}
                  </span>
                )}
                {priorityStyle && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold",
                      priorityStyle.bg,
                      priorityStyle.text,
                    )}
                  >
                    {priorityStyle.label}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground">
                  Role
                </span>
                <span className="text-xs">{task.role || "-"}</span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground">
                  Depends On
                </span>
                {task.depends_on.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {task.depends_on.map((id) => (
                      <span
                        key={id}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground">
                  Blocks
                </span>
                {task.blocks.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {task.blocks.map((id) => (
                      <span
                        key={id}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function SprintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { sprint, isLoading, error, notFound } = useSprintDetail(id);
  const [selectedTask, setSelectedTask] = useState<SprintDetailTask | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<TabKey>("list");

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (notFound || !sprint) return <NotFoundState />;

  const percentage =
    sprint.progress.total > 0
      ? Math.round((sprint.progress.done / sprint.progress.total) * 100)
      : 0;

  return (
    <>
      <div className="space-y-3">
        {/* Back link */}
        <Link
          href="/sprint"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Sprints
        </Link>

        {/* Header - compact inline */}
        <div className="flex items-center gap-3 pb-2 border-b border-border">
          <span className={cn("status-dot", SPRINT_STATUS_DOT[sprint.status] ?? "bg-gray-400")} />
          <h1 className="text-sm font-semibold">{sprint.title}</h1>
          <span className="text-[10px] text-muted-foreground capitalize">
            {sprint.status.replace("_", " ")}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {sprint.progress.done}/{sprint.progress.total}
            </span>
            <Progress value={percentage} className="h-1 w-20" />
            <span className="text-[10px] text-muted-foreground">{percentage}%</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn("filter-pill", activeTab === tab.key && "active")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "list" && (
          <ListView sprint={sprint} onSelectTask={setSelectedTask} />
        )}
        {activeTab === "board" && (
          <BoardView sprint={sprint} onSelectTask={setSelectedTask} />
        )}
        {activeTab === "timeline" && (
          <TimelineView sprint={sprint} onSelectTask={setSelectedTask} />
        )}
      </div>

      <TaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </>
  );
}
