// Task 상태 타입 및 스타일 상수
export type TaskStatus = "pending" | "in_progress" | "in_review" | "done";

export const STATUS_STYLES: Record<TaskStatus, { bg: string; dot: string; label: string }> = {
  pending: { bg: "bg-gray-500", dot: "bg-gray-400", label: "Pending" },
  in_progress: { bg: "bg-blue-500", dot: "bg-blue-500", label: "In Progress" },
  in_review: { bg: "bg-orange-500", dot: "bg-orange-400", label: "In Review" },
  done: { bg: "bg-green-500", dot: "bg-emerald-500", label: "Done" },
} as const;

// 우선순위 타입 및 스타일 상수
export type TaskPriority = "critical" | "high" | "medium" | "low";

export const PRIORITY_STYLES: Record<
  TaskPriority,
  { bg: string; text: string; label: string }
> = {
  critical: { bg: "bg-red-500/15", text: "text-red-400", label: "Critical" },
  high: { bg: "bg-orange-500/15", text: "text-orange-400", label: "High" },
  medium: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Medium" },
  low: { bg: "bg-zinc-500/15", text: "text-zinc-400", label: "Low" },
} as const;
