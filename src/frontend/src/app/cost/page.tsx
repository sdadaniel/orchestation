"use client";

import { AlertCircle } from "lucide-react";
import { useCosts } from "@/hooks/useCosts";
import { useRunHistory } from "@/hooks/useRunHistory";
import { useOrchestrationStatus } from "@/hooks/useOrchestrationStatus";
import { SummaryCards } from "@/components/cost/SummaryCards";
import { CostTable } from "@/components/cost/CostTable";
import { CumulativeCostChart } from "@/components/cost/CumulativeCostChart";
import { RunHistory } from "@/components/cost/RunHistory";
import { Skeleton } from "@/components/ui/skeleton";
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
      <p className="text-xs text-muted-foreground">No execution history.</p>
    </div>
  );
}

export default function CostPage() {
  const { data, isLoading, error, refetch: refetchCosts } = useCosts();
  const {
    runs,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useRunHistory();
  const { justFinished, clearFinished } = useOrchestrationStatus();

  // Auto-refresh when orchestration finishes
  useEffect(() => {
    if (justFinished) {
      refetchCosts();
      refetchHistory();
      clearFinished();
    }
  }, [justFinished, refetchCosts, refetchHistory, clearFinished]);

  if (isLoading || historyLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;

  const hasCostData = data && data.entries.length > 0;
  const hasRunHistory = runs.length > 0;

  if (!hasCostData && !hasRunHistory) return <EmptyState />;

  return (
    <div className="space-y-6">
      {hasCostData && (
        <>
          <SummaryCards
            entries={data.entries}
            summaryByTask={data.summaryByTask}
          />
          <CumulativeCostChart entries={data.entries} />
          <CostTable entries={data.entries} />
        </>
      )}

      {hasRunHistory && <RunHistory runs={runs} />}
    </div>
  );
}
