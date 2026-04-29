import type { RunHistoryEntry } from "@/hooks/useRunHistory";
import type { CostEntry, TaskCostSummary } from "@/parser/cost-parser";
import type { SortDirection } from "../useSortableTable";

export interface SortIconProps {
  active: boolean;
  direction: SortDirection;
}

export interface SummaryCardsProps {
  entries: CostEntry[];
  summaryByTask: TaskCostSummary[];
}

export interface CumulativeCostChartProps {
  entries: CostEntry[];
}

export interface ChartDataPoint {
  timestamp: string;
  label: string;
  cost: number;
  cumulative: number;
}

export interface CostTableProps {
  entries: CostEntry[];
}

export type SortColumn =
  | "taskId"
  | "phase"
  | "model"
  | "cost"
  | "time"
  | "turns"
  | "tokens"
  | "timestamp";

export interface RunHistoryProps {
  runs: RunHistoryEntry[];
}

export type RunSortColumn =
  | "time"
  | "status"
  | "tasks"
  | "duration"
  | "cost"
  | "details";
