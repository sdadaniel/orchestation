"use client";

import { useCosts } from "@/hooks/useCosts";
import { useOrchestrationStore } from "@/store/orchestrationStore";
import { SummaryCards } from "@/components/Cost/SummaryCards";
import { CostTable } from "@/components/Cost/CostTable";
import { CumulativeCostChart } from "@/components/Cost/CumulativeCostChart";
import { PageLayout, PageHeader } from "@/components/ui/page-layout";
import { useEffect } from "react";
import { EmptyState, ErrorState, LoadingSkeleton } from "./components";

export default function CostPageView() {
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
