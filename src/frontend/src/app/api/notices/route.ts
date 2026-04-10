import { NextResponse } from "next/server";
import fs from "fs";
import { parseAllNotices, getNoticesDir } from "@/lib/notice-parser";
import type { NoticeData, NoticeType } from "@/lib/notice-parser";
import { getErrorMessage } from "@/lib/error-utils";
import { generateSlug } from "@/lib/slug-utils";
import { getDb, isDbAvailable } from "@/lib/db";

export const dynamic = "force-dynamic";

interface NoticeRow {
  notice_id: string | null;
  title: string | null;
  content: string | null;
  type: string | null;
  created: string | null;
}

const VALID_NOTICE_TYPES = ["info", "warning", "error", "request"] as const;

function toNoticeType(value: string | null): NoticeType {
  if (value && (VALID_NOTICE_TYPES as readonly string[]).includes(value)) {
    return value as NoticeType;
  }
  return "info";
}

export async function GET() {
  if (isDbAvailable()) {
    const db = getDb()!;
    try {
      const rows = db
        .prepare(
          "SELECT notice_id, title, content, type, created FROM notices ORDER BY notice_id DESC",
        )
        .all() as NoticeRow[];

      const notices: NoticeData[] = rows.map((row) => ({
        id: row.notice_id ?? "",
        title: row.title ?? "",
        type: toNoticeType(row.type),
        read: false,
        created: row.created ?? "",
        updated: row.created ?? "",
        content: row.content ?? "",
      }));

      return NextResponse.json(notices);
    } catch {
      // Fall through to file-based
    }
  }

  const notices = parseAllNotices();
  return NextResponse.json(notices);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, content, type } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const noticeType = (VALID_NOTICE_TYPES as readonly string[]).includes(type)
      ? type
      : "info";

    const dir = getNoticesDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const existingFiles = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("NOTICE-") && f.endsWith(".md"));

    let maxNum = 0;
    for (const f of existingFiles) {
      const m = f.match(/NOTICE-(\d+)/);
      if (m) {
        const num = parseInt(m[1]!, 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    const noticeId = `NOTICE-${String(nextNum).padStart(3, "0")}`;
    const sanitizedTitle = title.trim();
    const bodyContent =
      content && typeof content === "string" ? content.trim() : "";

    const today = new Date().toISOString().split("T")[0];

    const fileContent = `---
id: ${noticeId}
title: ${sanitizedTitle}
type: ${noticeType}
read: false
created: ${today}
updated: ${today}
---
${bodyContent}
`;

    const slug = generateSlug(sanitizedTitle);
    const filePath = `${dir}/${noticeId}-${slug}.md`;
    fs.writeFileSync(filePath, fileContent, "utf-8");

    return NextResponse.json(
      {
        id: noticeId,
        title: sanitizedTitle,
        type: noticeType,
        read: false,
        created: today,
        updated: today,
        content: bodyContent,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to create notice") },
      { status: 500 },
    );
  }
}
