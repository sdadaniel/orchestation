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
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type CostTab = "cost" | "history";

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
  const [activeTab, setActiveTab] = useState<CostTab>("cost");

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

  const TABS: { key: CostTab; label: string; count: number }[] = [
    { key: "cost", label: "비용", count: data?.entries.length ?? 0 },
    { key: "history", label: "실행 이력", count: runs.length },
  ];

  return (
    <div className="space-y-6">
      {hasCostData && (
        <>
          <SummaryCards
            entries={data.entries}
            summaryByTask={data.summaryByTask}
          />
          <CumulativeCostChart entries={data.entries} />
        </>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            <span className="text-[10px] text-muted-foreground">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "cost" && (
        hasCostData ? (
          <CostTable entries={data.entries} />
        ) : (
          <div className="py-8 text-center">
            <p className="text-xs text-muted-foreground">비용 데이터가 없습니다.</p>
          </div>
        )
      )}

      {activeTab === "history" && (
        hasRunHistory ? (
          <RunHistory runs={runs} />
        ) : (
          <div className="py-8 text-center">
            <p className="text-xs text-muted-foreground">실행 이력이 없습니다.</p>
          </div>
        )
      )}
    </div>
  );
}
