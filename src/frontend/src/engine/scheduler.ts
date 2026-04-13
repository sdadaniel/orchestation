/**
 * scheduler.ts
 *
 * 태스크 스케줄링 순수 함수 모음.
 * orchestrate-engine.ts에서 추출. side-effect 없음 (DB read만).
 */
import { execSync } from "child_process";
import {
  getTasksByStatus,
  getTask,
  parseScope,
  parseDependsOn,
  type TaskRow,
} from "../service/task-store";

export type TaskStatus =
  | "pending"
  | "stopped"
  | "in_progress"
  | "reviewing"
  | "done"
  | "rejected"
  | "failed";

export interface TaskInfo {
  id: string;
  filePath: string;
  status: TaskStatus;
  priority: string;
  branch: string;
  worktree: string;
  role: string;
  reviewerRole: string;
  scope: string[];
  dependsOn: string[];
  sortOrder: number;
  title: string;
}

export interface WorkerRef {
  taskId: string;
}

export function taskRowToInfo(row: TaskRow): TaskInfo {
  return {
    id: row.id,
    filePath: "",
    status: row.status as TaskStatus,
    priority: row.priority || "medium",
    branch: row.branch || "",
    worktree: row.worktree || "",
    role: row.role || "",
    reviewerRole: row.reviewer_role || "",
    scope: parseScope(row),
    dependsOn: parseDependsOn(row),
    sortOrder: row.sort_order || 0,
    title: row.title || "",
  };
}

export function scanTasks(): TaskInfo[] {
  const rows = getTasksByStatus("pending", "stopped");
  const tasks = rows
    .filter((r) => r.status !== "done" && r.status !== "in_progress")
    .map(taskRowToInfo);

  const statusWeight = (s: string) => (s === "stopped" ? 0 : 1);
  const priorityWeight = (p: string) =>
    ({ high: 1, medium: 2, low: 3 })[p] ?? 4;

  tasks.sort(
    (a, b) =>
      statusWeight(a.status) - statusWeight(b.status) ||
      priorityWeight(a.priority) - priorityWeight(b.priority) ||
      a.sortOrder - b.sortOrder ||
      a.id.localeCompare(b.id),
  );

  return tasks;
}

export function depsSatisfied(task: TaskInfo): boolean {
  if (task.dependsOn.length === 0) return true;
  for (const dep of task.dependsOn) {
    const row = getTask(dep);
    if (!row || row.status !== "done") return false;
  }
  return true;
}

export function scopeNotConflicting(
  task: TaskInfo,
  workers: Map<string, WorkerRef>,
  log: (msg: string) => void,
): boolean {
  if (task.scope.length === 0) return true;

  for (const [runningId] of workers) {
    const row = getTask(runningId);
    if (!row) continue;
    const runningScope = parseScope(row);
    if (runningScope.length === 0) continue;

    for (const ns of task.scope) {
      for (const rs of runningScope) {
        if (ns === rs) {
          log(`  ⚠️  ${task.id}: scope 충돌 (${ns}) ← ${runningId} 실행 중`);
          return false;
        }
        const nsBase = ns.replace(/\/\*\*$/, "");
        const rsBase = rs.replace(/\/\*\*$/, "");
        if (nsBase.startsWith(rsBase) || rsBase.startsWith(nsBase)) {
          log(
            `  ⚠️  ${task.id}: scope 충돌 (${ns} ↔ ${rs}) ← ${runningId} 실행 중`,
          );
          return false;
        }
      }
    }
  }
  return true;
}

export function canDispatch(): boolean {
  try {
    const output = execSync(
      "memory_pressure 2>/dev/null | grep -o 'The system is under .*memory pressure' | awk '{print $6}'",
      { encoding: "utf-8", timeout: 3000 },
    ).trim();
    if (output === "critical" || output.startsWith("warn")) return false;
  } catch {
    /* non-macOS or command failed */
  }
  return true;
}
