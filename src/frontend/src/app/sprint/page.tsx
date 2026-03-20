"use client";

import Link from "next/link";
import { AlertCircle, Calendar } from "lucide-react";
import { useSprints } from "@/hooks/useSprints";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

const SPRINT_STATUS_STYLES: Record<string, { bg: string; label: string }> = {
  ready: { bg: "bg-gray-500", label: "Ready" },
  in_progress: { bg: "bg-blue-500", label: "In Progress" },
  done: { bg: "bg-green-500", label: "Done" },
};

function StatusBadge({ status }: { status: string }) {
  const style = SPRINT_STATUS_STYLES[status] ?? {
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border bg-card p-5">
          <Skeleton className="mb-3 h-5 w-32" />
          <Skeleton className="mb-4 h-5 w-16 rounded-full" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="mt-2 h-4 w-20" />
        </div>
      ))}
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

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <Calendar className="h-10 w-10 text-muted-foreground" />
      <p className="text-muted-foreground">등록된 스프린트가 없습니다.</p>
    </div>
  );
}

export default function SprintListPage() {
  const { sprints, isLoading, error } = useSprints();

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (sprints.length === 0) return <EmptyState />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sprints.map((sprint) => {
        const percentage =
          sprint.progress.total > 0
            ? Math.round(
                (sprint.progress.done / sprint.progress.total) * 100,
              )
            : 0;

        return (
          <Link
            key={sprint.id}
            href={`/sprint/${sprint.id}`}
            className="group rounded-lg border bg-card p-5 transition-colors hover:bg-muted/50"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold truncate">{sprint.title}</h2>
              <StatusBadge status={sprint.status} />
            </div>

            <div className="space-y-2">
              <Progress value={percentage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {sprint.progress.done}/{sprint.progress.total} 완료 ({percentage}%)
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
