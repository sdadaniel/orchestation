import fs from "fs";
import path from "path";
import { NOTICES_DIR } from "../lib/paths";
import { parseFrontmatter, getString, getBool } from "../lib/frontmatter-utils";

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

const VALID_NOTICE_TYPES = ["info", "warning", "error", "request"] as const;

function isValidNoticeType(value: string): value is NoticeType {
  return (VALID_NOTICE_TYPES as readonly string[]).includes(value);
}

// NOTICES_DIR is imported from paths.ts

export function parseNoticeFile(filePath: string): NoticeData | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = parseFrontmatter(raw);

    if (Object.keys(data).length === 0) return null;

    const id = getString(data, "id") || path.basename(filePath, ".md");
    const title = getString(data, "title");
    const typeStr = getString(data, "type") || "info";
    const type = isValidNoticeType(typeStr) ? typeStr : "info";
    const read = getBool(data, "read");
    const created = getString(data, "created");
    const updated = getString(data, "updated") || created;

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

export function writeNotice(type: NoticeType, title: string, content: string): void {
  try {
    if (!fs.existsSync(NOTICES_DIR)) {
      fs.mkdirSync(NOTICES_DIR, { recursive: true });
    }

    const files = fs.readdirSync(NOTICES_DIR).filter((f) => f.startsWith("NOTICE-") && f.endsWith(".md"));
    let maxNum = 0;
    for (const f of files) {
      const m = f.match(/NOTICE-(\d+)/);
      if (m) {
        const num = parseInt(m[1]!, 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    const noticeId = `NOTICE-${String(nextNum).padStart(3, "0")}`;
    const today = new Date().toISOString().split("T")[0];
    const slug = title.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/-+$/, "");

    const fileContent = `---
id: ${noticeId}
title: ${title.trim()}
type: ${type}
read: false
created: ${today}
updated: ${today}
---
${content.trim()}
`;

    fs.writeFileSync(path.join(NOTICES_DIR, `${noticeId}-${slug}.md`), fileContent, "utf-8");
  } catch { /* ignore */ }
}
