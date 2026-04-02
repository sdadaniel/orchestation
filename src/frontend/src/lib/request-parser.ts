import fs from "fs";
import path from "path";
import { TASKS_DIR } from "./paths";
import { parseFrontmatter, getString, getInt, getStringArray } from "./frontmatter-utils";
import { formatDatetime, formatTime } from "./date-utils";

export interface RequestData {
  id: string;
  title: string;
  status: "pending" | "stopped" | "in_progress" | "reviewing" | "done" | "rejected";
  priority: "high" | "medium" | "low";
  created: string;
  updated: string;
  content: string;
  depends_on: string[];
  scope: string[];
  sort_order: number;
  branch: string;
}

const VALID_STATUSES = ["pending", "stopped", "in_progress", "reviewing", "done", "failed", "rejected"] as const;
const VALID_PRIORITIES = ["high", "medium", "low"] as const;

function isValidStatus(value: string): value is RequestData["status"] {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

function isValidPriority(value: string): value is RequestData["priority"] {
  return (VALID_PRIORITIES as readonly string[]).includes(value);
}


export function parseRequestFile(filePath: string): RequestData | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = parseFrontmatter(raw);

    if (Object.keys(data).length === 0) return null;

    const id = getString(data, "id") || path.basename(filePath, ".md");
    const title = getString(data, "title");
    const statusStr = getString(data, "status") || "pending";
    const status = isValidStatus(statusStr) ? statusStr : "pending";
    const priorityStr = getString(data, "priority") || "medium";
    const priority = isValidPriority(priorityStr) ? priorityStr : "medium";
    const sort_order = getInt(data, "sort_order", 0);
    const branch = getString(data, "branch");

    // mtime fallback for created/updated
    const mt = fs.statSync(filePath).mtime;
    const mtime = formatDatetime(mt);
    const timeStr = formatTime(mt);
    const rawCreated = getString(data, "created");
    const rawUpdated = getString(data, "updated");
    const created = rawCreated ? (rawCreated.length <= 10 ? `${rawCreated} ${timeStr}` : rawCreated) : mtime;
    const updated = rawUpdated ? (rawUpdated.length <= 10 ? `${rawUpdated} ${timeStr}` : rawUpdated) : mtime;

    // gray-matter가 YAML 배열(inline/multiline 모두)을 자동으로 파싱
    const depends_on = getStringArray(data, "depends_on");
    const scope = getStringArray(data, "scope");

    return { id, title, status, priority, created, updated, content, depends_on, scope, sort_order, branch };
  } catch {
    return null;
  }
}

export function parseAllRequests(): RequestData[] {
  if (!fs.existsSync(TASKS_DIR)) return [];

  const files = fs.readdirSync(TASKS_DIR).filter((f) => f.startsWith("TASK-") && f.endsWith(".md"));
  const requests: RequestData[] = [];

  for (const file of files) {
    const req = parseRequestFile(path.join(TASKS_DIR, file));
    if (req) requests.push(req);
  }

  // Sort: pending first, then in_progress, then done
  const statusOrder: Record<string, number> = { pending: 0, reviewing: 1, in_progress: 2, rejected: 3, done: 4 };
  return requests.sort((a, b) => {
    const so = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
    if (so !== 0) return so;
    return a.id.localeCompare(b.id);
  });
}

export function findRequestFile(id: string): string | null {
  if (!fs.existsSync(TASKS_DIR)) return null;
  const files = fs.readdirSync(TASKS_DIR);
  const file = files.find((f) => f.startsWith(id) && f.endsWith(".md"));
  return file ? path.join(TASKS_DIR, file) : null;
}

export function getRequestsDir(): string {
  return TASKS_DIR;
}
