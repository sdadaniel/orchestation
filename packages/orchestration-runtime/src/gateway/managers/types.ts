import { ORCHESTRATION_STATUS } from "./const";

export type OrchestrationStatus =
  (typeof ORCHESTRATION_STATUS)[keyof typeof ORCHESTRATION_STATUS];

export interface OrchestrationStatusData {
  status: OrchestrationStatus;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  taskResults: { taskId: string; status: "success" | "failure" }[];
}

export interface TaskResult {
  taskId: string;
  status: "success" | "failure";
}

export interface OrchestrationState {
  status: OrchestrationStatus;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  /** logs[0]가 의미하는 절대 인덱스 (클리핑 시 증가) */
  logBase: number;
  taskResults: TaskResult[];
  exitCode: number | null;
}

