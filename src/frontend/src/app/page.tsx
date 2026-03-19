"use client";

import { AlertCircle } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { WaterfallContainer } from "@/components/waterfall/WaterfallContainer";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-lg border bg-card">
          <div className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="h-2 w-24" />
          </div>
          <div className="flex flex-col gap-1 p-4">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-12 w-full rounded-md" />
            ))}
          </div>
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

export default function TaskPage() {
  const { groups, isLoading, error } = useTasks();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">등록된 태스크가 없습니다.</p>
      </div>
    );
  }

  return <WaterfallContainer groups={groups} />;
}
