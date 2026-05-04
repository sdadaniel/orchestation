import type { ReactNode } from "react";
import type { RunHistoryEntry } from "@/hooks/useRunHistory";
import type { CostEntry } from "@/parser/cost-parser";
import type { SortDirection } from "../useSortableTable";

export interface SortIconProps {
  active: boolean;
  direction: SortDirection;
}

export interface SummaryCardsProps {
  entries: CostEntry[];
}

export interface DailyCostChartProps {
  entries: CostEntry[];
  /** 기간 pill 왼쪽에 붙는 컨트롤 (예: phase 필터) */
  toolbarStart?: ReactNode;
}

export type CostChartRange = "1D" | "1W" | "1M" | "ALL";

export interface ChartDataPoint {
  /** 정렬·툴팁용 전체 키 (날짜 또는 `YYYY-MM-DD HH`) */
  bucketKey: string;
  /** X축 짧은 라벨 */
  label: string;
  costUsd: number;
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
