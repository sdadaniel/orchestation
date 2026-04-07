/**
 * task-store.ts — SQLite 단일 저장소 기반 태스크 CRUD
 * 마크다운 파일 대신 SQLite를 source of truth로 사용
 */
import { getWritableDb, getDb } from "./db";
import { formatTimestamp } from "../lib/date-utils";

export interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  branch: string | null;
  worktree: string | null;
  role: string;
  reviewer_role: string | null;
  scope: string;    // JSON array string
  context: string;  // JSON array string
  depends_on: string; // JSON array string
  complexity: string | null;
  sort_order: number;
  content: string;
  created: string;
  updated: string;
}

function now(): string {
  return formatTimestamp(new Date());
}

// ── Read ──────────────────────────────────────────────

export function getTask(taskId: string): TaskRow | null {
  const db = getDb();
  if (!db) return null;
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as TaskRow | undefined ?? null;
}

export function getAllTasks(): TaskRow[] {
  const db = getDb();
  if (!db) return [];
  return db.prepare("SELECT * FROM tasks ORDER BY sort_order, id").all() as TaskRow[];
}

export function getTasksByStatus(...statuses: string[]): TaskRow[] {
  const db = getDb();
  if (!db) return [];
  const placeholders = statuses.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM tasks WHERE status IN (${placeholders}) ORDER BY sort_order, id`).all(...statuses) as TaskRow[];
}


export function getNextTaskId(): string {
  const db = getDb();
  if (!db) return "TASK-001";
  const row = db.prepare(
    "SELECT id FROM tasks ORDER BY CAST(SUBSTR(id, 6) AS INTEGER) DESC LIMIT 1"
  ).get() as { id: string } | undefined;
  if (!row) return "TASK-001";
  const num = parseInt(row.id.replace("TASK-", ""), 10);
  return `TASK-${String(num + 1).padStart(3, "0")}`;
}

// ── Write ─────────────────────────────────────────────

export function createTask(task: {
  id: string;
  title: string;
  status?: string;
  priority?: string;
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
}): TaskRow {
  const db = getWritableDb();
  if (!db) throw new Error("Database not available");

  const ts = now();
  db.prepare(
    `INSERT INTO tasks (id, title, status, priority, branch, worktree, role, reviewer_role,
      scope, context, depends_on, complexity, sort_order, content, created, updated)
     VALUES (@id, @title, @status, @priority, @branch, @worktree, @role, @reviewer_role,
      @scope, @context, @depends_on, @complexity, @sort_order, @content, @created, @updated)`
  ).run({
    id: task.id,
    title: task.title,
    status: task.status ?? "pending",
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

  return getTask(task.id)!;
}

export function updateTask(taskId: string, fields: Partial<{
  title: string;
  status: string;
  priority: string;
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
}>): boolean {
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
  return true;
}

export function updateTaskStatus(taskId: string, newStatus: string, fromStatus?: string): boolean {
  const db = getWritableDb();
  if (!db) return false;

  db.prepare("UPDATE tasks SET status = ?, updated = ? WHERE id = ?").run(newStatus, now(), taskId);

  // 이벤트 기록
  db.prepare(
    "INSERT INTO task_events (task_id, event_type, from_status, to_status, timestamp) VALUES (?, 'status_change', ?, ?, ?)"
  ).run(taskId, fromStatus ?? null, newStatus, now());

  return true;
}

export function deleteTask(taskId: string): boolean {
  const db = getWritableDb();
  if (!db) return false;
  const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
  return result.changes > 0;
}

// ── Helpers ───────────────────────────────────────────

export function parseScope(task: TaskRow): string[] {
  try { return JSON.parse(task.scope); } catch { return []; }
}

export function parseDependsOn(task: TaskRow): string[] {
  try { return JSON.parse(task.depends_on); } catch { return []; }
}

export function parseContext(task: TaskRow): string[] {
  try { return JSON.parse(task.context); } catch { return []; }
}

/** TaskRow를 마크다운 frontmatter 문자열로 변환 (임시 파일 생성용) */
export function taskRowToMarkdown(task: TaskRow): string {
  const scope = parseScope(task);
  const context = parseContext(task);
  const dependsOn = parseDependsOn(task);

  const lines = [
    "---",
    `id: ${task.id}`,
    `title: ${task.title}`,
    `status: ${task.status}`,
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
