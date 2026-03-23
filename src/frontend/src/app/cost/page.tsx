"use client";

import { AlertCircle, DollarSign } from "lucide-react";
import { useCosts } from "@/hooks/useCosts";
import { SummaryCards } from "@/components/cost/SummaryCards";
import { CostTable } from "@/components/cost/CostTable";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-5">
            <Skeleton className="mb-2 h-4 w-20" />
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card p-4">
        <Skeleton className="mb-3 h-4 w-full" />
        <Skeleton className="mb-3 h-4 w-full" />
        <Skeleton className="mb-3 h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
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
      <DollarSign className="h-10 w-10 text-muted-foreground" />
      <p className="text-muted-foreground">실행 기록이 없습니다</p>
    </div>
  );
}

export default function CostPage() {
  const { data, isLoading, error } = useCosts();

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data || data.entries.length === 0) return <EmptyState />;

  return (
    <div className="space-y-6">
      <SummaryCards entries={data.entries} summaryByTask={data.summaryByTask} />
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          태스크별 비용
        </h2>
        <CostTable entries={data.entries} />
      </div>
    </div>
  );
}
