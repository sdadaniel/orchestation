import { getDb, getWritableDb } from "./db";

export interface RunHistoryEntry {
  id: string;
  startedAt: string;
  finishedAt: string;
  status: "completed" | "failed";
  exitCode: number | null;
  taskResults: { taskId: string; status: "success" | "failure" }[];
  totalCostUsd: number;
  totalDurationMs: number;
  tasksCompleted: number;
  tasksFailed: number;
}

export interface RunHistoryData {
  runs: RunHistoryEntry[];
}

interface RunHistoryRow {
  id: string;
  started_at: string;
  finished_at: string;
  status: string;
  exit_code: number | null;
  task_results: string;
  total_cost_usd: number;
  total_duration_ms: number;
  tasks_completed: number;
  tasks_failed: number;
}

function rowToEntry(row: RunHistoryRow): RunHistoryEntry {
  let taskResults: { taskId: string; status: "success" | "failure" }[] = [];
  try {
    taskResults = JSON.parse(row.task_results);
  } catch {
    /* ignore */
  }

  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status as "completed" | "failed",
    exitCode: row.exit_code,
    taskResults,
    totalCostUsd: row.total_cost_usd,
    totalDurationMs: row.total_duration_ms,
    tasksCompleted: row.tasks_completed,
    tasksFailed: row.tasks_failed,
  };
}

export function readRunHistory(): RunHistoryData {
  const db = getDb();
  if (!db) return { runs: [] };

  try {
    const rows = db
      .prepare("SELECT * FROM run_history ORDER BY started_at DESC")
      .all() as RunHistoryRow[];

    return { runs: rows.map(rowToEntry) };
  } catch {
    return { runs: [] };
  }
}

export function appendRunHistory(entry: RunHistoryEntry): void {
  const db = getWritableDb();
  if (!db) return;

  db.prepare(
    `
    INSERT OR REPLACE INTO run_history
      (id, started_at, finished_at, status, exit_code, task_results, total_cost_usd, total_duration_ms, tasks_completed, tasks_failed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    entry.id,
    entry.startedAt,
    entry.finishedAt,
    entry.status,
    entry.exitCode,
    JSON.stringify(entry.taskResults),
    entry.totalCostUsd,
    entry.totalDurationMs,
    entry.tasksCompleted,
    entry.tasksFailed,
  );
}
