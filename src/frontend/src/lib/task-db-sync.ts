import fs from "fs";
import path from "path";
import {
  getInt,
  getString,
  getStringArray,
  parseFrontmatter,
} from "./frontmatter-utils";
import { getWritableDb } from "./db";
import { TASKS_DIR } from "./paths";
import { formatTimestamp } from "./date-utils";

function syncParsedTask(filePath: string, raw: string) {
  const db = getWritableDb();
  if (!db) return false;

  const { data, content } = parseFrontmatter(raw);
  const fallbackId =
    path.basename(filePath, ".md").match(/^(TASK-\d+)/)?.[1] ??
    path.basename(filePath, ".md");
  const id = getString(data, "id", fallbackId);
  const title = getString(data, "title");
  if (!id || !title) return false;

  const stat = fs.statSync(filePath);
  const fallbackTime = formatTimestamp(stat.mtime);
  const created = getString(data, "created", fallbackTime);
  const updated = getString(data, "updated", fallbackTime);

  db.prepare(
    `INSERT INTO tasks (
      id, title, status, priority, branch, worktree, role, reviewer_role,
      scope, context, depends_on, complexity, sort_order, content, created, updated
    ) VALUES (
      @id, @title, @status, @priority, @branch, @worktree, @role, @reviewer_role,
      @scope, @context, @depends_on, @complexity, @sort_order, @content, @created, @updated
    )
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      status=excluded.status,
      priority=excluded.priority,
      branch=excluded.branch,
      worktree=excluded.worktree,
      role=excluded.role,
      reviewer_role=excluded.reviewer_role,
      scope=excluded.scope,
      context=excluded.context,
      depends_on=excluded.depends_on,
      complexity=excluded.complexity,
      sort_order=excluded.sort_order,
      content=excluded.content,
      created=excluded.created,
      updated=excluded.updated`,
  ).run({
    id,
    title,
    status: getString(data, "status", "pending"),
    priority: getString(data, "priority", "medium"),
    branch: getString(data, "branch") || null,
    worktree: getString(data, "worktree") || null,
    role: getString(data, "role", "general"),
    reviewer_role: getString(data, "reviewer_role") || null,
    scope: JSON.stringify(getStringArray(data, "scope")),
    context: JSON.stringify(getStringArray(data, "context")),
    depends_on: JSON.stringify(getStringArray(data, "depends_on")),
    complexity: getString(data, "complexity") || null,
    sort_order: getInt(data, "sort_order", 0),
    content,
    created,
    updated,
  });

  return true;
}

export function syncTaskFileToDb(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const raw = fs.readFileSync(filePath, "utf-8");
  return syncParsedTask(filePath, raw);
}

export function syncTaskContentToDb(filePath: string, raw: string): boolean {
  return syncParsedTask(filePath, raw);
}

export function syncAllTaskFilesToDb(): number {
  const db = getWritableDb();
  if (!db || !fs.existsSync(TASKS_DIR)) return 0;

  let synced = 0;
  for (const file of fs.readdirSync(TASKS_DIR)) {
    if (!file.endsWith(".md")) continue;
    if (syncTaskFileToDb(path.join(TASKS_DIR, file))) {
      synced += 1;
    }
  }
  return synced;
}

export function deleteTaskFromDb(taskId: string): void {
  const db = getWritableDb();
  if (!db) return;
  db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
}
