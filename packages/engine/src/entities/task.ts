import type { StepType } from "../orchestrate/runner/step-runner";

/** TaskEntity.status — SQLite `tasks.status`와 동일한 값 집합 */
export type TaskStatus =
  | "pending"
  | "stopped"
  | "in_progress"
  | "reviewing"
  | "done"
  | "failed"
  | "rejected";

export type TaskPriority = "high" | "medium" | "low";

export interface TaskEntity {
  id: string;
  display_id: string | null;
  display_number: number | null;
  legacy_task_key: string | null;
  title: string;
  status: TaskStatus;
  phase: string | null;
  priority: TaskPriority;
  branch: string | null;
  worktree: string | null;
  role: string;
  reviewer_role: string | null;
  scope: string; // JSON array string
  context: string; // JSON array string
  depends_on: string; // JSON array string
  complexity: string | null;
  sort_order: number;
  content: string;
  created: string;
  updated: string;
}

export interface TaskStepEntity {
  id: string;
  task_id: string;
  step_key: string;
  step_type: StepType;
  status: string;
  attempt: number;
  max_attempts: number | null;
  inputs: string; // JSON object string
  outputs: string; // JSON object string
  started_at: string | null;
  finished_at: string | null;
  created: string;
  updated: string;
}

export interface TaskEventEntity {
  id: number;
  task_id: string;
  step_id: string | null;
  event_type: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus | null;
  detail: string | null;
  timestamp: string;
}
