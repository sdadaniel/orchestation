"use client";

import { useCosts } from "@/hooks/useCosts";
import { useOrchestrationStore } from "@/store/orchestrationStore";
import { SummaryCards } from "@/components/Cost/SummaryCards";
import { CostTable } from "@/components/Cost/CostTable";
import { DailyCostChart } from "@/components/Cost/DailyCostChart";
import { PageLayout, PageHeader } from "@/components/ui/page-layout";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingSkeleton } from "./components";

export default function CostPageView() {
  const { data, isLoading, error, refetch: refetchCosts } = useCosts();
  const justFinished = useOrchestrationStore((s) => s.justFinished);
  const clearFinished = useOrchestrationStore((s) => s.clearFinished);
  const [phase, setPhase] = useState<string | null>(null);

  const phaseOptions = useMemo(() => {
    if (!data?.entries?.length) return [] as string[];
    const s = new Set<string>();
    for (const e of data.entries) s.add(e.phase ?? "");
    return [...s].sort((a, b) => {
      if (a === "" && b !== "") return 1;
      if (b === "" && a !== "") return -1;
      return a.localeCompare(b);
    });
  }, [data]);

  const filteredEntries = useMemo(() => {
    if (!data) return [];
    if (phase === null) return data.entries;
    return data.entries.filter((e) => (e.phase ?? "") === phase);
  }, [data, phase]);

  useEffect(() => {
    if (phase !== null && !phaseOptions.includes(phase)) {
      setPhase(null);
    }
  }, [phase, phaseOptions]);

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

  const phaseToolbar = (
    <div className="flex min-w-[8.5rem] max-w-[14rem] flex-col gap-1">
      <Label htmlFor="cost-phase-filter" size="sm">
        Phase
      </Label>
      <Select
        id="cost-phase-filter"
        size="sm"
        value={phase === null ? "all" : phase}
        onChange={(e) => {
          const v = e.target.value;
          setPhase(v === "all" ? null : v);
        }}
      >
        <option value="all">전체</option>
        {phaseOptions.map((p) => (
          <option key={p === "" ? "__empty__" : p} value={p}>
            {p === "" ? "(없음)" : p}
          </option>
        ))}
      </Select>
    </div>
  );

  return (
    <PageLayout>
      <PageHeader title="Cost" />
      <div className="space-y-4">
        <SummaryCards entries={filteredEntries} />
        <DailyCostChart
          entries={filteredEntries}
          toolbarStart={phaseToolbar}
        />
        <CostTable entries={filteredEntries} />
      </div>
    </PageLayout>
  );
}
