import { NextResponse } from "next/server";
import fs from "fs";
import { parseAllNotices, getNoticesDir } from "@/parser/notice-parser";
import { getErrorMessage } from "@/lib/errors/error-utils";
import { generateSlug } from "@/lib/strings/slug-utils";
import { isDbAvailable } from "@/service/db";
import {
  createNotice,
  getAllNotices,
  getNextNoticeDisplayId,
} from "@/service/notice-store";

export const dynamic = "force-dynamic";

const VALID_NOTICE_TYPES = ["info", "warning", "error", "request"] as const;

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const size = parsePositiveInt(searchParams.get("size"), 20);
  const summary = searchParams.get("summary") === "1";
  const unreadOnly = searchParams.get("filter") === "unread";

  if (isDbAvailable()) {
    try {
      const notices = getAllNotices();
      if (summary) {
        const filtered = unreadOnly ? notices.filter((notice) => !notice.read) : notices;
        const start = (page - 1) * size;
        const items = filtered.slice(start, start + size).map((notice) => ({
          id: notice.id,
          display_id: notice.display_id,
          title: notice.title,
          type: notice.type,
          created: notice.created,
          updated: notice.updated,
        }));
        return NextResponse.json({
          items,
          total: filtered.length,
          unreadCount: notices.filter((notice) => !notice.read).length,
          page,
          size,
        });
      }
      return NextResponse.json(notices);
    } catch {
      // Fall through to file-based
    }
  }

  const notices = parseAllNotices();
  if (summary) {
    const filtered = unreadOnly ? notices.filter((notice) => !notice.read) : notices;
    const start = (page - 1) * size;
    const items = filtered.slice(start, start + size).map((notice) => ({
      id: notice.id,
      display_id: notice.display_id,
      title: notice.title,
      type: notice.type,
      created: notice.created,
      updated: notice.updated,
    }));
    return NextResponse.json({
      items,
      total: filtered.length,
      unreadCount: notices.filter((notice) => !notice.read).length,
      page,
      size,
    });
  }
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

    const noticeId = getNextNoticeDisplayId();
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

    const created = createNotice({
      title: sanitizedTitle,
      content: bodyContent,
      type: noticeType,
      display_id: noticeId,
      legacy_notice_key: noticeId,
      read: false,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to create notice") },
      { status: 500 },
    );
  }
}
