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
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  // Map task id -> batch index & row index
  const taskBatchIndex = new Map<string, number>();
  const taskRowIndex = new Map<string, number>();
  batches.forEach((batch, idx) => {
    for (const task of batch.tasks) {
      taskBatchIndex.set(task.id, idx);
    }
  });
  allTasks.forEach((task, idx) => {
    taskRowIndex.set(task.id, idx);
  });

  const ROW_HEIGHT = 36;
  const LABEL_WIDTH = 260;
  const COL_WIDTH = 120;
  const BAR_HEIGHT = 20;
  const HEADER_HEIGHT = 32;
  const totalHeight = HEADER_HEIGHT + allTasks.length * ROW_HEIGHT;
  const totalWidth = LABEL_WIDTH + batches.length * COL_WIDTH;

  // Build dependency links
  const links: { from: string; to: string; fromRow: number; toRow: number; fromCol: number; toCol: number }[] = [];
  allTasks.forEach((task) => {
    const toRow = taskRowIndex.get(task.id) ?? 0;
    const toCol = taskBatchIndex.get(task.id) ?? 0;
    for (const depId of task.depends_on) {
      if (taskBatchIndex.has(depId)) {
        const fromRow = taskRowIndex.get(depId) ?? 0;
        const fromCol = taskBatchIndex.get(depId) ?? 0;
        links.push({ from: depId, to: task.id, fromRow, toRow, fromCol, toCol });
      }
    }
  });

  return (
    <div className="relative overflow-x-auto border border-border rounded-md">
      <div style={{ width: totalWidth, minHeight: totalHeight, position: "relative" }}>

        {/* SVG layer for dependency curves */}
        <svg
          style={{ position: "absolute", top: 0, left: 0, width: totalWidth, height: totalHeight, pointerEvents: "none" }}
        >
          {links.map((link) => {
            const linkId = `${link.from}->${link.to}`;
            const isHovered = hoveredLink === linkId;

            // Source: right edge of source bar
            const x1 = LABEL_WIDTH + link.fromCol * COL_WIDTH + COL_WIDTH - 10;
            const y1 = HEADER_HEIGHT + link.fromRow * ROW_HEIGHT + ROW_HEIGHT / 2;
            // Target: left edge of target bar
            const x2 = LABEL_WIDTH + link.toCol * COL_WIDTH + 10;
            const y2 = HEADER_HEIGHT + link.toRow * ROW_HEIGHT + ROW_HEIGHT / 2;

            const dx = Math.abs(x2 - x1) * 0.5;
            const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

            return (
              <g key={linkId}>
                {/* Hit area (wider, invisible) */}
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onMouseEnter={() => setHoveredLink(linkId)}
                  onMouseLeave={() => setHoveredLink(null)}
                />
                {/* Visible curve */}
                <path
                  d={path}
                  fill="none"
                  stroke={isHovered ? "var(--primary)" : "var(--muted-foreground)"}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  strokeDasharray={isHovered ? "none" : "none"}
                  opacity={isHovered ? 1 : 0.4}
                  style={{ transition: "all 0.15s ease" }}
                />
                {/* Arrow at target end */}
                <polygon
                  points={`${x2},${y2} ${x2 - 6},${y2 - 4} ${x2 - 6},${y2 + 4}`}
                  fill={isHovered ? "var(--primary)" : "var(--muted-foreground)"}
                  opacity={isHovered ? 1 : 0.4}
                  style={{ transition: "all 0.15s ease" }}
                />
              </g>
            );
          })}
        </svg>

        {/* Header row */}
        <div className="flex" style={{ height: HEADER_HEIGHT, borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
          <div style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }} className="flex items-center px-3 text-xs font-medium text-muted-foreground uppercase border-r border-border">
            Task
          </div>
          {batches.map((batch, idx) => (
            <div key={idx} style={{ width: COL_WIDTH }} className="flex items-center justify-center text-xs text-muted-foreground font-medium border-r border-border last:border-r-0">
              {batch.name}
            </div>
          ))}
        </div>

        {/* Task rows */}
        {allTasks.map((task, rowIdx) => {
          const batchIdx = taskBatchIndex.get(task.id) ?? 0;
          const statusStyle = STATUS_STYLES[task.status as TaskStatus];
          const barColor = statusStyle?.bg.replace("bg-", "") ?? "gray-400";
          // Map tailwind color to CSS
          const colorMap: Record<string, string> = {
            "gray-500": "#6b7280", "blue-500": "#3b82f6", "orange-500": "#f97316",
            "green-500": "#22c55e", "emerald-500": "#10b981", "gray-400": "#9ca3af",
            "orange-400": "#fb923c",
          };
          const bgColor = colorMap[barColor] ?? "#6b7280";

          return (
            <div
              key={task.id}
              className="flex hover:bg-muted/30 transition-colors"
              style={{ height: ROW_HEIGHT, borderBottom: "1px solid var(--border)" }}
            >
              {/* Task label */}
              <button
                type="button"
                className="flex items-center gap-2 px-3 text-left border-r border-border hover:bg-muted/50 transition-colors"
                style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }}
                onClick={() => onSelectTask(task)}
              >
                <span className={cn("w-2 h-2 rounded-full shrink-0", statusStyle?.dot ?? "bg-gray-400")} />
                <span className="font-mono text-xs text-muted-foreground shrink-0">{task.id}</span>
                <span className="text-sm truncate">{task.title}</span>
              </button>

              {/* Bar columns */}
              {batches.map((_, colIdx) => (
                <div
                  key={colIdx}
                  className="flex items-center px-2 border-r border-border last:border-r-0"
                  style={{ width: COL_WIDTH }}
                >
                  {colIdx === batchIdx && (
                    <div
                      style={{ width: "100%", height: BAR_HEIGHT, borderRadius: 4, background: bgColor, opacity: 0.85 }}
                      title={task.title}
                    />
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Hover tooltip for links */}
      {hoveredLink && (
        <div className="fixed bottom-16 right-8 bg-card border border-border rounded px-2 py-1 text-xs shadow-lg z-50">
          {hoveredLink.replace("->", " → ")}
        </div>
      )}
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
