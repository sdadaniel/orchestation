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
} from "../../service/task-store";
import type { TaskEntity, TaskStatus } from "../../entities/task";
import { parseDependsOn, parseScope } from "../../lib/task-row-parsers";

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

export function taskRowToInfo(row: TaskEntity): TaskInfo {
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

// 실행 게이트: dependsOn에 있는 선행 태스크가 모두 "done"인 경우에만 디스패치 가능
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
  // macOS에서는 `memory_pressure`로 시스템 메모리 압박(critical/warn)을 감지할 수 있다.
  // 메모리가 빡빡한 상태에서 새 워커를 더 띄우면 전체가 느려지거나 실패율이 올라가므로,
  // 이 경우에는 "지금은 디스패치하지 말자"로 판단한다.
  //
  // non-macOS(또는 커맨드 실패) 환경에서는 이 신호를 못 쓰므로 항상 true로 fallback한다.
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

