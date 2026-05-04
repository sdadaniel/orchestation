import type { TaskPriority, TaskStatus } from "@/entities/task";
import {
  getAllTasks as getAllTasksFromDb,
} from "../service/task-store";
import type { TaskEntity } from "../entities/task";
import { parseDependsOn, parseScope } from "../lib/task-row-parsers";

export interface TaskFrontmatter {
  id: string;
  display_id?: string;
  canonical_id?: string;
  title: string;
  status: TaskStatus;
  phase?: string | null;
  priority: TaskPriority;
  depends_on: string[];
  blocks: string[];
  parallel_with: string[];
  role: string;
  affected_files: string[];
}

const VALID_STATUSES: readonly TaskStatus[] = [
  "pending",
  "stopped",
  "in_progress",
  "reviewing",
  "done",
  "failed",
  "rejected",
];

const VALID_PRIORITIES: readonly TaskPriority[] = ["high", "medium", "low"];

function toTaskStatus(value: unknown): TaskStatus {
  if (
    typeof value === "string" &&
    (VALID_STATUSES as readonly string[]).includes(value)
  ) {
    return value as TaskStatus;
  }
  return "pending";
}

function toTaskPriority(value: unknown): TaskPriority {
  if (
    typeof value === "string" &&
    (VALID_PRIORITIES as readonly string[]).includes(value)
  ) {
    return value as TaskPriority;
  }
  return "medium";
}

// TTL 캐시: 3초간 유효 (폴링 결합 시 초당 수회 DB 쿼리 방지)
let _tasksCache: TaskFrontmatter[] | null = null;
let _tasksCacheTime = 0;
const CACHE_TTL_MS = 3000;

/** TaskEntity를 TaskFrontmatter로 변환 */
function taskRowToFrontmatter(row: TaskEntity): TaskFrontmatter {
  return {
    id: row.id,
    display_id: row.display_id ?? row.id,
    canonical_id: row.id,
    title: row.title,
    status: toTaskStatus(row.status),
    phase: row.phase ?? null,
    priority: toTaskPriority(row.priority),
    depends_on: parseDependsOn(row),
    blocks: [],
    parallel_with: [],
    role: row.role ?? "",
    affected_files: parseScope(row),
  };
}

export function parseAllTasks(): TaskFrontmatter[] {
  const now = Date.now();
  if (_tasksCache && now - _tasksCacheTime < CACHE_TTL_MS) {
    return _tasksCache;
  }

  const rows = getAllTasksFromDb();
  const tasks = rows.map(taskRowToFrontmatter);

  _tasksCache = tasks;
  _tasksCacheTime = now;
  return tasks;
}

/** 캐시 무효화 (태스크 변경 시 호출) */
export function invalidateTasksCache() {
  _tasksCache = null;
  _tasksCacheTime = 0;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return [];
}
