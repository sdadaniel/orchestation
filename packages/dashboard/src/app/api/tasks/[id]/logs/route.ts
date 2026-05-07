import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors/error-utils";
import { isValidTaskId, taskExists, getTaskLogs } from "@/parser/task-log-parser";
import type { TaskLogEntry } from "@/parser/task-log-parser";
import { getDb, isDbAvailable } from "@/service/db";
import { resolveTaskRef } from "@/service/task-store";

export const dynamic = "force-dynamic";

interface TokenUsageRow {
  task_id: string;
  step_id: string | null;
  step_key: string | null;
  step_type: string | null;
  phase: string;
  turns: number;
  duration_ms: number;
  cost_usd: number;
  timestamp: string;
}

interface TaskEventRow {
  task_id: string;
  step_id: string | null;
  step_key: string | null;
  step_type: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  detail: string | null;
  timestamp: string;
}

function getLogsFromDb(taskId: string): TaskLogEntry[] | null {
  if (!isDbAvailable()) return null;

  const db = getDb()!;
  const resolvedTaskId = resolveTaskRef(taskId)?.task.id;
  if (!resolvedTaskId) return null;

  // Check task exists in DB
  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(resolvedTaskId) as
    | { id: string }
    | undefined;
  if (!task) return null;

  const entries: TaskLogEntry[] = [];

  // Token usage entries
  try {
    const tokenRows = db
      .prepare(
        `SELECT u.task_id, u.step_id, s.step_key, s.step_type, u.phase, u.turns, u.duration_ms, u.cost_usd, u.timestamp
         FROM token_usage u
         LEFT JOIN task_steps s ON s.id = u.step_id
         WHERE u.task_id = ?
         ORDER BY u.timestamp`,
      )
      .all(resolvedTaskId) as TokenUsageRow[];

    for (const row of tokenRows) {
      const stepPart =
        row.step_key || row.step_type
          ? `step=${row.step_key ?? "?"}(${row.step_type ?? "?"}) | `
          : "";
      entries.push({
        timestamp: row.timestamp,
        level: "info",
        message: `${stepPart}phase=${row.phase} | turns=${row.turns} | duration=${row.duration_ms}ms | cost=$${row.cost_usd}`,
      });
    }
  } catch {
    // table may not exist
  }

  // Task events
  try {
    const eventRows = db
      .prepare(
        `SELECT e.task_id, e.step_id, s.step_key, s.step_type, e.event_type, e.from_status, e.to_status, e.detail, e.timestamp
         FROM task_events e
         LEFT JOIN task_steps s ON s.id = e.step_id
         WHERE e.task_id = ?
         ORDER BY e.timestamp`,
      )
      .all(resolvedTaskId) as TaskEventRow[];

    for (const row of eventRows) {
      const stepTag =
        row.step_key || row.step_type
          ? `${row.step_key ?? "?"}(${row.step_type ?? "?"}) `
          : "";
      const parts = [`[${stepTag}${row.event_type}]`];
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

/** SQLite 이벤트/토큰과 output/*.log·JSONL 등 파일 로그를 합친다. 동일 줄은 한 번만 남긴다. */
function mergeTaskLogEntries(
  fromDb: TaskLogEntry[],
  fromFiles: TaskLogEntry[],
): TaskLogEntry[] {
  const seen = new Set<string>();
  const out: TaskLogEntry[] = [];
  for (const e of [...fromDb, ...fromFiles]) {
    const key = `${e.timestamp}\0${e.level}\0${e.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return out;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const resolvedTask = resolveTaskRef(id)?.task;
    const url = new URL(request.url);
    const includeConversation =
      url.searchParams.get("includeConversation") !== "0";

    // Validate task ID format
    if (!isValidTaskId(id)) {
      return NextResponse.json(
        { error: "Invalid task ID format" },
        { status: 400 },
      );
    }

    const dbLogs = getLogsFromDb(id);
    const fromDb = dbLogs ?? [];

    let fromFiles: TaskLogEntry[] = [];
    if (resolvedTask && taskExists(resolvedTask.id)) {
      fromFiles = getTaskLogs(resolvedTask.id, { includeConversation });
    }

    const logs = mergeTaskLogEntries(fromDb, fromFiles);

    if (logs.length === 0) {
      if (!resolvedTask || !taskExists(resolvedTask.id)) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "No logs found for this task" },
        { status: 404 },
      );
    }

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
