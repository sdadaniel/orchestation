export interface CostEntry {
  phase: string;
  cost: string;
  duration: string;
  tokens: string;
}

export interface DepRef {
  id: string;
  title: string;
  status: string;
}

export interface ExecutionLog {
  subtype?: string;
  num_turns?: number;
  duration_ms?: number;
  total_cost_usd?: number;
  result?: string;
}

export interface ReviewResult {
  subtype?: string;
  result?: string;
}

export interface TaskDetail {
  id: string;
  title: string;
  status: string;
  priority: string;
  created: string;
  content: string;
  depends_on_detail: DepRef[];
  depended_by: DepRef[];
  executionLog: ExecutionLog | null;
  reviewResult: ReviewResult | null;
  costEntries: CostEntry[];
  scope: string[];
  branch: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export const STATUS_DOT: Record<string, string> = {
  stopped: "bg-violet-500",
  pending: "bg-yellow-500",
  in_progress: "bg-blue-500",
  reviewing: "bg-orange-500",
  done: "bg-emerald-500",
  rejected: "bg-red-500",
};

export const STATUS_LABEL: Record<string, string> = {
  stopped: "Stopped",
  pending: "Pending",
  in_progress: "In Progress",
  reviewing: "Reviewing",
  done: "Done",
  rejected: "Rejected",
};

export const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-500 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  low: "bg-green-500/15 text-green-500 border-green-500/30",
};
