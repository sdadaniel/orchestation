import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { TaskStatus, TaskPriority } from "../../lib/constants";
import { TASKS_DIR } from "./paths";

export interface TaskFrontmatter {
  id: string;
  title: string;
  status: TaskStatus;
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
  if (typeof value === "string" && (VALID_STATUSES as readonly string[]).includes(value)) {
    return value as TaskStatus;
  }
  return "pending";
}

function toTaskPriority(value: unknown): TaskPriority {
  if (typeof value === "string" && (VALID_PRIORITIES as readonly string[]).includes(value)) {
    return value as TaskPriority;
  }
  return "medium";
}


export function parseTaskFile(filePath: string): TaskFrontmatter | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(content);

    if (!data.id || !data.title) {
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      status: toTaskStatus(data.status),
      priority: toTaskPriority(data.priority),
      depends_on: toStringArray(data.depends_on),
      blocks: toStringArray(data.blocks),
      parallel_with: toStringArray(data.parallel_with),
      role: data.role ?? "",
      affected_files: toStringArray(data.affected_files),
    };
  } catch {
    return null;
  }
}

// TTL 캐시: 3초간 유효 (폴링 결합 시 초당 수회 디스크 I/O 방지)
let _tasksCache: TaskFrontmatter[] | null = null;
let _tasksCacheTime = 0;
const CACHE_TTL_MS = 3000;

export function parseAllTasks(): TaskFrontmatter[] {
  const now = Date.now();
  if (_tasksCache && now - _tasksCacheTime < CACHE_TTL_MS) {
    return _tasksCache;
  }

  if (!fs.existsSync(TASKS_DIR)) {
    _tasksCache = [];
    _tasksCacheTime = now;
    return _tasksCache;
  }

  const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith(".md"));
  const tasks: TaskFrontmatter[] = [];

  for (const file of files) {
    const task = parseTaskFile(path.join(TASKS_DIR, file));
    if (task) {
      tasks.push(task);
    }
  }

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
