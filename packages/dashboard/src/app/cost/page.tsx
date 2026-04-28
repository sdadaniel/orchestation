"use client";

import { AlertCircle } from "lucide-react";
import { useCosts } from "@/hooks/useCosts";
import { useOrchestrationStore } from "@/store/orchestrationStore";
import { SummaryCards } from "@/components/cost/SummaryCards";
import { CostTable } from "@/components/cost/CostTable";
import { CumulativeCostChart } from "@/components/cost/CumulativeCostChart";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLayout, PageHeader } from "@/components/ui/page-layout";
import { useEffect } from "react";

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-6 py-2 border-b border-border">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-baseline gap-1.5">
            <Skeleton className="h-2 w-10" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
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

function EmptyState() {
  return (
    <div className="py-8 text-center">
      <p className="text-xs text-muted-foreground">No cost data.</p>
    </div>
  );
}

export default function CostPage() {
  const { data, isLoading, error, refetch: refetchCosts } = useCosts();
  const justFinished = useOrchestrationStore((s) => s.justFinished);
  const clearFinished = useOrchestrationStore((s) => s.clearFinished);

  // Auto-refresh when orchestration finishes
  useEffect(() => {
    if (justFinished) {
      refetchCosts();
      clearFinished();
    }
  }, [justFinished, refetchCosts, clearFinished]);

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;

  const hasCostData = data && data.entries.length > 0;
  if (!hasCostData) return <EmptyState />;

  return (
    <PageLayout>
      <PageHeader title="Cost" />
      <div className="space-y-4">
        <SummaryCards
          entries={data.entries}
          summaryByTask={data.summaryByTask}
        />
        <CumulativeCostChart entries={data.entries} />
        <CostTable entries={data.entries} />
      </div>
    </PageLayout>
  );
}
