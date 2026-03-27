import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parseAllRequests, getRequestsDir } from "@/lib/request-parser";
import { generateNextTaskId } from "@/lib/task-id";
import { getErrorMessage } from "@/lib/error-utils";
import { PROJECT_ROOT } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET() {
  const requests = parseAllRequests();
  return NextResponse.json(requests);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, content, priority, scope, depends_on, role } = body;

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
    const taskId = generateNextTaskId(dir);
    const sanitizedTitle = title.trim();
    const bodyContent = (content && typeof content === "string") ? content.trim() : "";

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    const scopeLines = Array.isArray(scope) && scope.length > 0
      ? `scope:\n${scope.map((s: string) => `  - ${s}`).join("\n")}\n`
      : "";
    const dependsOnLines = Array.isArray(depends_on) && depends_on.length > 0
      ? `depends_on: [${depends_on.join(", ")}]\n`
      : "";
    let validRoles: string[];
    try {
      const rolesDir = path.join(PROJECT_ROOT, "docs", "roles");
      validRoles = fs.readdirSync(rolesDir)
        .filter((f) => f.endsWith(".md") && !f.startsWith("reviewer-") && f !== "README.md")
        .map((f) => f.replace(".md", ""));
    } catch {
      validRoles = ["general"];
    }
    const taskRole = typeof role === "string" && validRoles.includes(role) ? role : "";
    const roleLine = taskRole && taskRole !== "general" ? `role: ${taskRole}\n` : "";

    const fileContent = `---
id: ${taskId}
title: ${sanitizedTitle}
status: pending
priority: ${taskPriority}
${roleLine}${scopeLines}${dependsOnLines}created: ${today}
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
      { error: getErrorMessage(err, "Failed to create task") },
      { status: 500 },
    );
  }
}
