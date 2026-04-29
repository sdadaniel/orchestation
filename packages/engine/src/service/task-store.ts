/**
 * task-store.ts — SQLite 단일 저장소 기반 태스크 CRUD
 * 마크다운 파일 대신 SQLite를 source of truth로 사용
 */
import { getWritableDb, getDb } from "./db";
import { formatTimestamp } from "../lib/time/date-utils";
import {
  parseContext,
  parseDependsOn,
  parseScope,
} from "../lib/task-row-parsers";
import { publish } from "../bus";
import { parseWorkflowFromTaskContent } from "../lib/workflow";
import type { StepType } from "../orchestrate/runner/step-runner";
import type {
  TaskEntity,
  TaskPriority,
  TaskStatus,
  TaskStepEntity,
} from "../entities/task";

function now(): string {
  return formatTimestamp(new Date());
}

function notifyTaskChanged(
  taskId?: string,
  extra?: Record<string, unknown>,
): void {
  publish("task-changed", { full: true, ...(taskId ? { taskId } : {}), ...extra });
}

// ── Read ──────────────────────────────────────────────

export function getTask(taskId: string): TaskEntity | null {
  const db = getDb();
  if (!db) return null;
  return (
    (db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as
      | TaskEntity
      | undefined) ?? null
  );
}

export function getAllTasks(): TaskEntity[] {
  const db = getDb();
  if (!db) return [];
  return db
    .prepare("SELECT * FROM tasks ORDER BY sort_order, id")
    .all() as TaskEntity[];
}

export function getTasksByStatus(...statuses: TaskStatus[]): TaskEntity[] {
  const db = getDb();
  if (!db) return [];
  const placeholders = statuses.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT * FROM tasks WHERE status IN (${placeholders}) ORDER BY sort_order, id`,
    )
    .all(...statuses) as TaskEntity[];
}

export function getTaskSteps(taskId: string): TaskStepEntity[] {
  const db = getDb();
  if (!db) return [];
  return db
    .prepare(
      `SELECT * FROM task_steps
       WHERE task_id = ?
       ORDER BY
         created ASC,
         CASE step_type
           WHEN 'task' THEN 0
           WHEN 'review' THEN 1
           WHEN 'check' THEN 2
           ELSE 9
         END ASC,
         step_key ASC`,
    )
    .all(taskId) as TaskStepEntity[];
}

export function getTaskStep(stepId: string): TaskStepEntity | null {
  const db = getDb();
  if (!db) return null;
  return (
    (db.prepare("SELECT * FROM task_steps WHERE id = ?").get(stepId) as
      | TaskStepEntity
      | undefined) ?? null
  );
}

export function updateTaskStep(
  stepId: string,
  patch: Partial<
    Pick<
      TaskStepEntity,
      | "status"
      | "attempt"
      | "max_attempts"
      | "inputs"
      | "outputs"
      | "started_at"
      | "finished_at"
    >
  >,
): void {
  const db = getWritableDb();
  if (!db) throw new Error("Database not available");

  const fields: string[] = [];
  const params: Record<string, unknown> = { id: stepId, updated: now() };

  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = @${k}`);
    params[k] = v;
  }
  fields.push("updated = @updated");

  if (fields.length === 0) return;
  db.prepare(`UPDATE task_steps SET ${fields.join(", ")} WHERE id = @id`).run(
    params,
  );
}

export function getNextTaskId(): string {
  const db = getDb();
  if (!db) return "TASK-001";
  const row = db
    .prepare(
      "SELECT id FROM tasks ORDER BY CAST(SUBSTR(id, 6) AS INTEGER) DESC LIMIT 1",
    )
    .get() as { id: string } | undefined;
  if (!row) return "TASK-001";
  const num = parseInt(row.id.replace("TASK-", ""), 10);
  return `TASK-${String(num + 1).padStart(3, "0")}`;
}

// ── Write ─────────────────────────────────────────────

export function createTask(task: {
  id: string;
  title: string;
  status?: TaskStatus;
  phase?: string | null;
  priority?: TaskPriority;
  role?: string;
  reviewer_role?: string;
  branch?: string;
  worktree?: string;
  scope?: string[];
  context?: string[];
  depends_on?: string[];
  complexity?: string;
  sort_order?: number;
  content?: string;
}): TaskEntity {
  const db = getWritableDb();
  if (!db) throw new Error("Database not available");

  const ts = now();
  db.prepare(
    `INSERT INTO tasks (id, title, status, phase, priority, branch, worktree, role, reviewer_role,
      scope, context, depends_on, complexity, sort_order, content, created, updated)
     VALUES (@id, @title, @status, @phase, @priority, @branch, @worktree, @role, @reviewer_role,
      @scope, @context, @depends_on, @complexity, @sort_order, @content, @created, @updated)`,
  ).run({
    id: task.id,
    title: task.title,
    status: task.status ?? "pending",
    phase: task.phase ?? null,
    priority: task.priority ?? "medium",
    branch: task.branch ?? null,
    worktree: task.worktree ?? null,
    role: task.role ?? "general",
    reviewer_role: task.reviewer_role ?? null,
    scope: JSON.stringify(task.scope ?? []),
    context: JSON.stringify(task.context ?? []),
    depends_on: JSON.stringify(task.depends_on ?? []),
    complexity: task.complexity ?? null,
    sort_order: task.sort_order ?? 0,
    content: task.content ?? "",
    created: ts,
    updated: ts,
  });

  const created = getTask(task.id)!;
  // 태스크 생성 시점에 workflow(frontmatter)를 파싱해서 step 레코드도 함께 생성한다.
  // (엔진 디스패치 전에 UI/DB에서도 step을 볼 수 있게 하기 위함)
  ensureTaskSteps(task.id, parseWorkflowFromTaskContent(created.content || ""));
  notifyTaskChanged(task.id, { status: created.status, phase: created.phase });
  return created;
}

export function ensureTaskSteps(
  taskId: string,
  steps: { key: string; type: StepType; maxAttempts?: number }[],
): void {
  const db = getWritableDb();
  if (!db) throw new Error("Database not available");

  const ts = now();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO task_steps
      (id, task_id, step_key, step_type, status, attempt, max_attempts, inputs, outputs, created, updated)
     VALUES
      (@id, @task_id, @step_key, @step_type, @status, @attempt, @max_attempts, @inputs, @outputs, @created, @updated)`,
  );

  const txn = db.transaction((defs: typeof steps) => {
    for (const def of defs) {
      const stepId = `${taskId}:${def.key}`;
      insert.run({
        id: stepId,
        task_id: taskId,
        step_key: def.key,
        step_type: def.type,
        status: "pending",
        attempt: 0,
        max_attempts: def.maxAttempts ?? null,
        inputs: "{}",
        outputs: "{}",
        created: ts,
        updated: ts,
      });
    }
  });
  txn(steps);
}

export function getNextPendingStep(taskId: string): TaskStepEntity | null {
  const db = getDb();
  if (!db) return null;
  return (
    (db
      .prepare(
        `SELECT * FROM task_steps
         WHERE task_id = ? AND status = 'pending'
         ORDER BY
           created ASC,
           CASE step_type
             WHEN 'task' THEN 0
             WHEN 'review' THEN 1
             WHEN 'check' THEN 2
             ELSE 9
           END ASC,
           step_key ASC
         LIMIT 1`,
      )
      .get(taskId) as TaskStepEntity | undefined) ?? null
  );
}

export function updateTask(
  taskId: string,
  fields: Partial<{
    title: string;
    status: TaskStatus;
    phase: string | null;
    priority: TaskPriority;
    branch: string;
    worktree: string;
    role: string;
    reviewer_role: string;
    scope: string[];
    context: string[];
    depends_on: string[];
    complexity: string;
    sort_order: number;
    content: string;
  }>,
): boolean {
  const db = getWritableDb();
  if (!db) return false;

  const sets: string[] = [];
  const values: Record<string, unknown> = { id: taskId };

  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined) continue;
    if (key === "scope" || key === "context" || key === "depends_on") {
      sets.push(`${key} = @${key}`);
      values[key] = JSON.stringify(val);
    } else {
      sets.push(`${key} = @${key}`);
      values[key] = val;
    }
  }

  if (sets.length === 0) return false;
  sets.push("updated = @updated");
  values.updated = now();

  db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = @id`).run(values);

  // 필드 변경 후 최신 task를 읽어서 변경된 필드와 함께 현재 상태를 함께 emit
  const updated = getTask(taskId);
  if (updated) {
    notifyTaskChanged(taskId, {
      // 변경된 필드 + 함께 보낼 관련 필드
      ...(fields.status ? { status: updated.status } : {}),
      ...("phase" in fields ? { phase: updated.phase, status: updated.status } : {}),
      ...(fields.priority ? { priority: updated.priority } : {}),
      ...(fields.title ? { title: updated.title } : {}),
    });
  } else {
    // fallback: task 조회 실패 시 전달된 필드로만 emit
    notifyTaskChanged(taskId, {
      ...(fields.status ? { status: fields.status } : {}),
      ...("phase" in fields ? { phase: fields.phase } : {}),
      ...(fields.priority ? { priority: fields.priority } : {}),
      ...(fields.title ? { title: fields.title } : {}),
    });
  }
  return true;
}

export function updateTaskPhase(taskId: string, phase: string | null): boolean {
  return updateTask(taskId, { phase });
}

export function recordStepEvent(
  taskId: string,
  stepId: string,
  eventType: string,
  detail?: string,
): void {
  const db = getWritableDb();
  if (!db) return;
  db.prepare(
    "INSERT INTO task_events (task_id, step_id, event_type, detail, timestamp) VALUES (?, ?, ?, ?, ?)",
  ).run(taskId, stepId, eventType, detail ?? null, now());
}

export function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  fromStatus?: TaskStatus,
): boolean {
  const db = getWritableDb();
  if (!db) return false;

  const ts = now();
  const shouldClearPhase =
    newStatus === "done" ||
    newStatus === "failed" ||
    newStatus === "rejected" ||
    newStatus === "stopped";

  if (shouldClearPhase) {
    db.prepare("UPDATE tasks SET status = ?, phase = NULL, updated = ? WHERE id = ?").run(
      newStatus,
      ts,
      taskId,
    );
  } else {
    db.prepare("UPDATE tasks SET status = ?, updated = ? WHERE id = ?").run(
      newStatus,
      ts,
      taskId,
    );
  }

  // 이벤트 기록
  db.prepare(
    "INSERT INTO task_events (task_id, event_type, from_status, to_status, timestamp) VALUES (?, 'status_change', ?, ?, ?)",
  ).run(taskId, fromStatus ?? null, newStatus, ts);

  // 상태 변경 후 최신 task를 읽어서 변경된 status 및 현재 phase를 함께 emit
  const updated = getTask(taskId);
  if (updated) {
    notifyTaskChanged(taskId, {
      status: updated.status,
      phase: updated.phase,
      ...(shouldClearPhase ? { phaseClearedAt: ts } : {}),
    });
  } else {
    // fallback: task 조회 실패 시 변경한 값으로만 emit
    notifyTaskChanged(taskId, { status: newStatus, ...(shouldClearPhase ? { phase: null } : {}) });
  }
  return true;
}

export function deleteTask(taskId: string): boolean {
  const db = getWritableDb();
  if (!db) return false;
  const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
  if (result.changes > 0) {
    notifyTaskChanged(taskId, { deleted: true });
  }
  return result.changes > 0;
}

/** TaskEntity를 마크다운 frontmatter 문자열로 변환 (임시 파일 생성용) */
export function taskRowToMarkdown(task: TaskEntity): string {
  const scope = parseScope(task);
  const context = parseContext(task);
  const dependsOn = parseDependsOn(task);

  const lines = [
    "---",
    `id: ${task.id}`,
    `title: ${task.title}`,
    `status: ${task.status}`,
    ...(task.phase ? [`phase: ${task.phase}`] : []),
    `priority: ${task.priority}`,
    `role: ${task.role}`,
  ];

  if (task.reviewer_role) lines.push(`reviewer_role: ${task.reviewer_role}`);
  if (task.branch) lines.push(`branch: ${task.branch}`);
  if (task.worktree) lines.push(`worktree: ${task.worktree}`);
  if (task.complexity) lines.push(`complexity: ${task.complexity}`);

  if (scope.length > 0) {
    lines.push("scope:");
    for (const s of scope) lines.push(`  - ${s}`);
  } else {
    lines.push("scope: []");
  }

  if (context.length > 0) {
    lines.push("context:");
    for (const c of context) lines.push(`  - ${c}`);
  } else {
    lines.push("context: []");
  }

  if (dependsOn.length > 0) {
    lines.push("depends_on:");
    for (const d of dependsOn) lines.push(`  - ${d}`);
  } else {
    lines.push("depends_on: []");
  }

  lines.push(`created: ${task.created}`);
  lines.push(`updated: ${task.updated}`);
  lines.push("---");
  lines.push("");

  if (task.content) {
    lines.push(task.content);
  }

  return lines.join("\n");
}
