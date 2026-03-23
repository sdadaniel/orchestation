import { NextResponse } from "next/server";
import fs from "fs";
import { parseAllRequests, getRequestsDir } from "@/lib/request-parser";

export const dynamic = "force-dynamic";

export async function GET() {
  const requests = parseAllRequests();
  return NextResponse.json(requests);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, content, priority } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const validPriorities = ["high", "medium", "low"];
    const reqPriority = validPriorities.includes(priority) ? priority : "medium";

    const dir = getRequestsDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Determine next REQ-XXX id
    const existingFiles = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("REQ-") && f.endsWith(".md"));

    let maxNum = 0;
    for (const f of existingFiles) {
      const m = f.match(/REQ-(\d+)/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    const reqId = `REQ-${String(nextNum).padStart(3, "0")}`;
    const sanitizedTitle = title.trim();
    const bodyContent = (content && typeof content === "string") ? content.trim() : "";

    const today = new Date().toISOString().split("T")[0];

    const fileContent = `---
id: ${reqId}
title: ${sanitizedTitle}
status: pending
priority: ${reqPriority}
created: ${today}
---
${bodyContent}
`;

    const slug = sanitizedTitle
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/-+$/, "");
    const filePath = `${dir}/${reqId}-${slug}.md`;
    fs.writeFileSync(filePath, fileContent, "utf-8");

    return NextResponse.json(
      { id: reqId, title: sanitizedTitle, status: "pending", priority: reqPriority, created: today, content: bodyContent },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create request" },
      { status: 500 },
    );
  }
}
