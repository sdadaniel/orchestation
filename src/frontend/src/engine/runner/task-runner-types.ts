export type TaskRunStatus = "idle" | "running" | "completed" | "failed";
export type TaskRunPhase = "task" | "review" | "merge" | "done";

export interface TaskRunState {
  taskId: string;
  status: TaskRunStatus;
  phase: TaskRunPhase;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  exitCode: number | null;
}
