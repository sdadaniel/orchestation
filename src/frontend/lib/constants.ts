// Task 상태 타입 및 스타일 상수
export type TaskStatus = "backlog" | "in_progress" | "in_review" | "done";

export const STATUS_STYLES: Record<TaskStatus, { bg: string; label: string }> = {
  backlog: { bg: "bg-gray-500", label: "Backlog" },
  in_progress: { bg: "bg-blue-500", label: "In Progress" },
  in_review: { bg: "bg-orange-500", label: "In Review" },
  done: { bg: "bg-green-500", label: "Done" },
} as const;

// 우선순위 타입 및 스타일 상수
export type TaskPriority = "critical" | "high" | "medium" | "low";

export const PRIORITY_STYLES: Record<
  TaskPriority,
  { bg: string; text: string; label: string }
> = {
  critical: { bg: "bg-red-100", text: "text-red-700", label: "Critical" },
  high: { bg: "bg-orange-100", text: "text-orange-700", label: "High" },
  medium: { bg: "bg-blue-100", text: "text-blue-700", label: "Medium" },
  low: { bg: "bg-gray-100", text: "text-gray-700", label: "Low" },
} as const;
