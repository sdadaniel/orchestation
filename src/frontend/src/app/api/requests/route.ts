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
    const { title, content, priority, scope, depends_on } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const validPriorities = ["high", "medium", "low"];
    const taskPriority = validPriorities.includes(priority) ? priority : "medium";

    const dir = getRequestsDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Determine next TASK-XXX id
    const existingFiles = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("TASK-") && f.endsWith(".md"));

    let maxNum = 0;
    for (const f of existingFiles) {
      const m = f.match(/TASK-(\d+)/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    const taskId = `TASK-${String(nextNum).padStart(3, "0")}`;
    const sanitizedTitle = title.trim();
    const bodyContent = (content && typeof content === "string") ? content.trim() : "";

    const today = new Date().toISOString().split("T")[0];

    const scopeLines = Array.isArray(scope) && scope.length > 0
      ? `scope:\n${scope.map((s: string) => `  - ${s}`).join("\n")}\n`
      : "";
    const dependsOnLines = Array.isArray(depends_on) && depends_on.length > 0
      ? `depends_on: [${depends_on.join(", ")}]\n`
      : "";

    const fileContent = `---
id: ${taskId}
title: ${sanitizedTitle}
status: pending
priority: ${taskPriority}
${scopeLines}${dependsOnLines}created: ${today}
updated: ${today}
---
${bodyContent}
`;

    const MAX_SLUG_LENGTH = 50;
    const slug = sanitizedTitle
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/-+$/, "")
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/-+$/, "");

    const fileName = `${taskId}-${slug}.md`;
    if (fileName.length > 255) {
      return NextResponse.json(
        { error: "Generated filename exceeds OS limit (255 chars)" },
        { status: 400 },
      );
    }
    const filePath = `${dir}/${fileName}`;
    fs.writeFileSync(filePath, fileContent, "utf-8");

    return NextResponse.json(
      { id: taskId, title: sanitizedTitle, status: "pending", priority: taskPriority, created: today, updated: today, content: bodyContent },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create task" },
      { status: 500 },
    );
  }
}
