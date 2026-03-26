import { NextResponse } from "next/server";
import fs from "fs";
import { parseAllNotices, getNoticesDir } from "@/lib/notice-parser";
import { getErrorMessage } from "@/lib/error-utils";

export const dynamic = "force-dynamic";

export async function GET() {
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

    const validTypes = ["info", "warning", "error", "request"];
    const noticeType = validTypes.includes(type) ? type : "info";

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
    const bodyContent = (content && typeof content === "string") ? content.trim() : "";

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

    const slug = sanitizedTitle
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/-+$/, "");
    const filePath = `${dir}/${noticeId}-${slug}.md`;
    fs.writeFileSync(filePath, fileContent, "utf-8");

    return NextResponse.json(
      { id: noticeId, title: sanitizedTitle, type: noticeType, read: false, created: today, updated: today, content: bodyContent },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to create notice") },
      { status: 500 },
    );
  }
}
