"use client";

import { DollarSign, Hash, Calculator, Coins } from "lucide-react";
import type { CostEntry, TaskCostSummary } from "@/lib/cost-parser";

interface SummaryCardsProps {
  entries: CostEntry[];
  summaryByTask: TaskCostSummary[];
}

interface CardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function Card({ icon, label, value }: CardProps) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-card-foreground">{value}</p>
    </div>
  );
}

export function SummaryCards({ entries, summaryByTask }: SummaryCardsProps) {
  const totalCost = entries.reduce((sum, e) => sum + e.costUsd, 0);
  const totalTasks = summaryByTask.length;
  const avgCostPerTask = totalTasks > 0 ? totalCost / totalTasks : 0;
  const totalTokens = entries.reduce(
    (sum, e) => sum + e.inputTokens + e.outputTokens + e.cacheCreate + e.cacheRead,
    0,
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        icon={<DollarSign className="h-4 w-4" />}
        label="총 비용"
        value={`$${totalCost.toFixed(4)}`}
      />
      <Card
        icon={<Hash className="h-4 w-4" />}
        label="총 태스크 수"
        value={`${totalTasks}`}
      />
      <Card
        icon={<Calculator className="h-4 w-4" />}
        label="평균 비용/태스크"
        value={`$${avgCostPerTask.toFixed(4)}`}
      />
      <Card
        icon={<Coins className="h-4 w-4" />}
        label="총 토큰 수"
        value={totalTokens.toLocaleString()}
      />
    </div>
  );
}
