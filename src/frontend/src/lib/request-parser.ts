import fs from "fs";
import path from "path";
import { TASKS_DIR } from "./paths";

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


export function parseRequestFile(filePath: string): RequestData | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");

    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;

    const fm = fmMatch[1];
    const id = fm.match(/^id:\s*(.+)$/m)?.[1]?.trim() || path.basename(filePath, ".md");
    const title = fm.match(/^title:\s*(.+)$/m)?.[1]?.trim() || "";
    const status = (fm.match(/^status:\s*(.+)$/m)?.[1]?.trim() || "pending") as RequestData["status"];
    const priority = (fm.match(/^priority:\s*(.+)$/m)?.[1]?.trim() || "medium") as RequestData["priority"];
    const mt = fs.statSync(filePath).mtime;
    const mtime = `${mt.getFullYear()}-${String(mt.getMonth()+1).padStart(2,"0")}-${String(mt.getDate()).padStart(2,"0")} ${String(mt.getHours()).padStart(2,"0")}:${String(mt.getMinutes()).padStart(2,"0")}`;
    const timeStr = `${String(mt.getHours()).padStart(2,"0")}:${String(mt.getMinutes()).padStart(2,"0")}`;
    const rawCreated = fm.match(/^created:\s*(.+)$/m)?.[1]?.trim() || "";
    const rawUpdated = fm.match(/^updated:\s*(.+)$/m)?.[1]?.trim() || "";
    const created = rawCreated ? (rawCreated.length <= 10 ? `${rawCreated} ${timeStr}` : rawCreated) : mtime;
    const updated = rawUpdated ? (rawUpdated.length <= 10 ? `${rawUpdated} ${timeStr}` : rawUpdated) : mtime;
    const sort_order = parseInt(fm.match(/^sort_order:\s*(.+)$/m)?.[1]?.trim() || "0", 10) || 0;
    const branch = fm.match(/^branch:\s*(.+)$/m)?.[1]?.trim() || "";

    const content = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();

    // Parse depends_on: supports both inline [A, B] and multi-line YAML list
    let depends_on: string[] = [];
    const inlineMatch = fm.match(/^depends_on:\s*\[([^\]]*)\]/m);
    if (inlineMatch) {
      depends_on = inlineMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      const mlMatch = fm.match(/^depends_on:\s*\n((?:\s+-\s+.+\n?)*)/m);
      if (mlMatch) {
        depends_on = mlMatch[1].match(/-\s*(.+)/g)?.map((s) => s.replace(/^- \s*/, "").trim()) || [];
      }
    }

    // Parse scope: multi-line YAML list
    let scope: string[] = [];
    const scopeMatch = fm.match(/^scope:\s*\n((?:\s+-\s+.+\n?)*)/m);
    if (scopeMatch) {
      scope = scopeMatch[1].match(/-\s*(.+)/g)?.map((s) => s.replace(/^- \s*/, "").trim()) || [];
    }

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
