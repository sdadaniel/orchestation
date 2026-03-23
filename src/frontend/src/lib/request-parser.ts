import fs from "fs";
import path from "path";

export interface RequestData {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "done";
  priority: "high" | "medium" | "low";
  created: string;
  content: string;
}

const REQUESTS_DIR = path.join(process.cwd(), "../../docs/requests");

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
    const created = fm.match(/^created:\s*(.+)$/m)?.[1]?.trim() || "";

    const content = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();

    return { id, title, status, priority, created, content };
  } catch {
    return null;
  }
}

export function parseAllRequests(): RequestData[] {
  if (!fs.existsSync(REQUESTS_DIR)) return [];

  const files = fs.readdirSync(REQUESTS_DIR).filter((f) => f.startsWith("REQ-") && f.endsWith(".md"));
  const requests: RequestData[] = [];

  for (const file of files) {
    const req = parseRequestFile(path.join(REQUESTS_DIR, file));
    if (req) requests.push(req);
  }

  // Sort: pending first, then in_progress, then done
  const statusOrder: Record<string, number> = { pending: 0, in_progress: 1, done: 2 };
  return requests.sort((a, b) => {
    const so = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
    if (so !== 0) return so;
    return a.id.localeCompare(b.id);
  });
}

export function findRequestFile(id: string): string | null {
  if (!fs.existsSync(REQUESTS_DIR)) return null;
  const files = fs.readdirSync(REQUESTS_DIR);
  const file = files.find((f) => f.startsWith(id) && f.endsWith(".md"));
  return file ? path.join(REQUESTS_DIR, file) : null;
}

export function getRequestsDir(): string {
  return REQUESTS_DIR;
}
