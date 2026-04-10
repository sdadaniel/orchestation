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

/**
 * 디렉토리에서 .md 파일을 읽어 파싱 결과 배열을 반환하는 제네릭 유틸리티.
 * @param dir       읽을 디렉토리 경로
 * @param parseFn   파일 경로를 받아 T | null을 반환하는 파서 함수
 * @param filterFn  (선택) 파일명 필터 함수 (기본: .md 파일 전체)
 * @param sortFn    (선택) 결과 배열 정렬 비교 함수
 */
export function parseAllFromDirectory<T>(
  dir: string,
  parseFn: (filePath: string) => T | null,
  filterFn?: (filename: string) => boolean,
  sortFn?: (a: T, b: T) => number,
): T[] {
  if (!fs.existsSync(dir)) return [];

  let files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  if (filterFn) {
    files = files.filter(filterFn);
  }

  const results: T[] = [];
  for (const file of files) {
    const item = parseFn(path.join(dir, file));
    if (item) results.push(item);
  }

  if (sortFn) {
    results.sort(sortFn);
  }

  return results;
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

  const tasks = parseAllFromDirectory<TaskFrontmatter>(
    TASKS_DIR,
    parseTaskFile,
  );
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
