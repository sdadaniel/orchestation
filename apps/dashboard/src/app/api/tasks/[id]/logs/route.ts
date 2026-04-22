import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/error-utils";
import {
  isValidTaskId,
  taskExists,
  hasLogSources,
  getTaskLogs,
} from "@/parser/task-log-parser";
import type { TaskLogEntry } from "@/parser/task-log-parser";
import { getDb, isDbAvailable } from "@/service/db";

export const dynamic = "force-dynamic";

interface TokenUsageRow {
  task_id: string;
  phase: string;
  turns: number;
  duration_ms: number;
  cost_usd: number;
  timestamp: string;
}

interface TaskEventRow {
  task_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  detail: string | null;
  timestamp: string;
}

function getLogsFromDb(taskId: string): TaskLogEntry[] | null {
  if (!isDbAvailable()) return null;

  const db = getDb()!;

  // Check task exists in DB
  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId) as
    | { id: string }
    | undefined;
  if (!task) return null;

  const entries: TaskLogEntry[] = [];

  // Token usage entries
  try {
    const tokenRows = db
      .prepare(
        "SELECT task_id, phase, turns, duration_ms, cost_usd, timestamp FROM token_usage WHERE task_id = ? ORDER BY timestamp",
      )
      .all(taskId) as TokenUsageRow[];

    for (const row of tokenRows) {
      entries.push({
        timestamp: row.timestamp,
        level: "info",
        message: `phase=${row.phase} | turns=${row.turns} | duration=${row.duration_ms}ms | cost=$${row.cost_usd}`,
      });
    }
  } catch {
    // table may not exist
  }

  // Task events
  try {
    const eventRows = db
      .prepare(
        "SELECT task_id, event_type, from_status, to_status, detail, timestamp FROM task_events WHERE task_id = ? ORDER BY timestamp",
      )
      .all(taskId) as TaskEventRow[];

    for (const row of eventRows) {
      const parts = [`[${row.event_type}]`];
      if (row.from_status && row.to_status) {
        parts.push(`${row.from_status} → ${row.to_status}`);
      }
      if (row.detail) {
        parts.push(row.detail);
      }

      entries.push({
        timestamp: row.timestamp,
        level:
          row.event_type === "review_result" && row.detail?.includes("reject")
            ? "error"
            : "info",
        message: parts.join(" "),
      });
    }
  } catch {
    // table may not exist
  }

  if (entries.length === 0) return null;

  entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return entries;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Validate task ID format
    if (!isValidTaskId(id)) {
      return NextResponse.json(
        { error: "Invalid task ID format" },
        { status: 400 },
      );
    }

    // Try SQLite first
    const dbLogs = getLogsFromDb(id);
    if (dbLogs) {
      return NextResponse.json(dbLogs);
    }

    // Fall back to file-based
    if (!taskExists(id)) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!hasLogSources(id)) {
      return NextResponse.json(
        { error: "No logs found for this task" },
        { status: 404 },
      );
    }

    const logs = getTaskLogs(id);

    return NextResponse.json(logs);
  } catch (err) {
    return NextResponse.json(
      {
        error: getErrorMessage(err, "Failed to retrieve logs"),
      },
      { status: 500 },
    );
  }
}
