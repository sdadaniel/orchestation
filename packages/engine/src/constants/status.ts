// Task 상태 타입
export type TaskStatus =
  | "pending"
  | "stopped"
  | "in_progress"
  | "reviewing"
  | "done"
  | "failed"
  | "rejected";

// 우선순위 타입
export type TaskPriority = "high" | "medium" | "low";
