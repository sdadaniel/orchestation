import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface TaskFrontmatter {
  id: string;
  title: string;
  status: string;
  priority: string;
  depends_on: string[];
  blocks: string[];
  parallel_with: string[];
  role: string;
  affected_files: string[];
}

const PROJECT_ROOT = path.resolve(process.cwd(), "..", "..");
const ORCH_TASKS_DIR = path.join(PROJECT_ROOT, ".orchestration", "tasks");
const LEGACY_TASKS_DIR = path.join(PROJECT_ROOT, "docs", "task");
const TASKS_DIR = fs.existsSync(ORCH_TASKS_DIR) ? ORCH_TASKS_DIR : LEGACY_TASKS_DIR;

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
      status: data.status ?? "unknown",
      priority: data.priority ?? "medium",
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

export function parseAllTasks(): TaskFrontmatter[] {
  if (!fs.existsSync(TASKS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith(".md"));
  const tasks: TaskFrontmatter[] = [];

  for (const file of files) {
    const task = parseTaskFile(path.join(TASKS_DIR, file));
    if (task) {
      tasks.push(task);
    }
  }

  return tasks;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return [];
}
