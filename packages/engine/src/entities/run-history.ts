export interface RunHistoryEntity {
  id: string;
  started_at: string;
  finished_at: string;
  status: "completed" | "failed" | string;
  exit_code: number | null;
  task_results: string;
  total_cost_usd: number;
  total_duration_ms: number;
  tasks_completed: number;
  tasks_failed: number;
}
