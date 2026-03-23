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
import type { SprintDetailTask } from "@/hooks/useSprintDetail";

const SPRINT_STATUS_STYLES: Record<string, { bg: string; label: string }> = {
  ready: { bg: "bg-zinc-500", label: "Ready" },
  in_progress: { bg: "bg-blue-500", label: "In Progress" },
  done: { bg: "bg-emerald-500", label: "Done" },
};

function SprintStatusBadge({ status }: { status: string }) {
  const style = SPRINT_STATUS_STYLES[status] ?? {
    bg: "bg-gray-400",
    label: status,
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${style.bg}`}
    >
      {style.label}
    </span>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status as TaskStatus] ?? {
    bg: "bg-gray-400",
    label: status,
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${style.bg}`}
    >
      {style.label}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-2 w-full max-w-md rounded-full" />
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="space-y-2">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <FileQuestion className="h-10 w-10 text-muted-foreground" />
      <p className="text-muted-foreground">존재하지 않는 스프린트입니다.</p>
      <Link
        href="/sprint"
        className="text-sm text-primary underline underline-offset-4"
      >
        스프린트 목록으로 돌아가기
      </Link>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-5 w-5" />
        <p>{message}</p>
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

            <div className="flex flex-col gap-4 px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {statusStyle && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white",
                      statusStyle.bg,
                    )}
                  >
                    {statusStyle.label}
                  </span>
                )}
                {priorityStyle && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      priorityStyle.bg,
                      priorityStyle.text,
                    )}
                  >
                    {priorityStyle.label}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Role
                </span>
                <span className="text-sm">{task.role || "-"}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Depends On
                </span>
                {task.depends_on.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {task.depends_on.map((id) => (
                      <span
                        key={id}
                        className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Blocks
                </span>
                {task.blocks.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {task.blocks.map((id) => (
                      <span
                        key={id}
                        className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
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

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (notFound || !sprint) return <NotFoundState />;

  const percentage =
    sprint.progress.total > 0
      ? Math.round((sprint.progress.done / sprint.progress.total) * 100)
      : 0;

  return (
    <>
      <div className="space-y-6">
        {/* Back link */}
        <Link
          href="/sprint"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          스프린트 목록
        </Link>

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">{sprint.title}</h1>
            <SprintStatusBadge status={sprint.status} />
          </div>
          <div className="max-w-md space-y-1">
            <Progress value={percentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {sprint.progress.done}/{sprint.progress.total} 완료 ({percentage}
              %)
            </p>
          </div>
        </div>

        {/* Batches */}
        <div className="space-y-5">
          {sprint.batches.map((batch) => (
            <section key={batch.name}>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                {batch.name}
              </h2>
              <div className="space-y-2">
                {batch.tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedTask(task)}
                    className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-muted hover:border-primary/20"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {task.id}
                      </span>
                      <span className="truncate text-sm">{task.title}</span>
                    </div>
                    <TaskStatusBadge status={task.status} />
                  </button>
                ))}
                {batch.tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">
                    배치에 등록된 Task가 없습니다.
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      <TaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </>
  );
}
