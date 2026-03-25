import fs from "fs";
import path from "path";

export type NoticeType = "info" | "warning" | "error" | "request";

export interface NoticeData {
  id: string;
  title: string;
  type: NoticeType;
  read: boolean;
  created: string;
  updated: string;
  content: string;
}

const NOTICES_DIR = path.join(process.cwd(), "../../docs/notice");

export function parseNoticeFile(filePath: string): NoticeData | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");

    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;

    const fm = fmMatch[1];
    const id = fm.match(/^id:\s*(.+)$/m)?.[1]?.trim() || path.basename(filePath, ".md");
    const title = fm.match(/^title:\s*(.+)$/m)?.[1]?.trim() || "";
    const type = (fm.match(/^type:\s*(.+)$/m)?.[1]?.trim() || "info") as NoticeType;
    const read = fm.match(/^read:\s*(.+)$/m)?.[1]?.trim() === "true";
    const created = fm.match(/^created:\s*(.+)$/m)?.[1]?.trim() || "";
    const updated = fm.match(/^updated:\s*(.+)$/m)?.[1]?.trim() || created;

    const content = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();

    return { id, title, type, read, created, updated, content };
  } catch {
    return null;
  }
}

export function parseAllNotices(): NoticeData[] {
  if (!fs.existsSync(NOTICES_DIR)) return [];

  const files = fs.readdirSync(NOTICES_DIR).filter((f) => f.startsWith("NOTICE-") && f.endsWith(".md"));
  const notices: NoticeData[] = [];

  for (const file of files) {
    const notice = parseNoticeFile(path.join(NOTICES_DIR, file));
    if (notice) notices.push(notice);
  }

  // Sort by newest first
  return notices.sort((a, b) => b.id.localeCompare(a.id));
}

export function findNoticeFile(id: string): string | null {
  if (!fs.existsSync(NOTICES_DIR)) return null;
  const files = fs.readdirSync(NOTICES_DIR);
  const file = files.find((f) => f.startsWith(id) && f.endsWith(".md"));
  return file ? path.join(NOTICES_DIR, file) : null;
}

export function getNoticesDir(): string {
  return NOTICES_DIR;
}
