import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parseAllRequests, getRequestsDir } from "@/lib/request-parser";
import type { RequestData } from "@/lib/request-parser";
import { generateNextTaskId } from "@/lib/task-id";
import { getErrorMessage } from "@/lib/error-utils";
import { PROJECT_ROOT } from "@/lib/paths";
import { generateSlug } from "@/lib/slug-utils";
import { getDb, isDbAvailable } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RequestRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  created: string | null;
  updated: string | null;
  content: string | null;
  depends_on: string | null;
  scope: string | null;
  sort_order: number;
  branch: string | null;
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function GET() {
  if (isDbAvailable()) {
    const db = getDb()!;
    const rows = db.prepare(
      "SELECT id, title, status, priority, created, updated, content, depends_on, scope, sort_order, branch FROM tasks ORDER BY id"
    ).all() as RequestRow[];

    const statusOrder: Record<string, number> = { pending: 0, reviewing: 1, in_progress: 2, rejected: 3, done: 4 };
    const requests: RequestData[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status as RequestData["status"],
      priority: row.priority as RequestData["priority"],
      created: row.created ?? "",
      updated: row.updated ?? "",
      content: row.content ?? "",
      depends_on: parseJsonArray(row.depends_on),
      scope: parseJsonArray(row.scope),
      sort_order: row.sort_order ?? 0,
      branch: row.branch ?? "",
    }));

    requests.sort((a, b) => {
      const so = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      if (so !== 0) return so;
      return a.id.localeCompare(b.id);
    });

    return NextResponse.json(requests);
  }

  const requests = parseAllRequests();
  return NextResponse.json(requests);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, content, priority, scope, context, depends_on, role } = body;

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
    const contextLines = Array.isArray(context) && context.length > 0
      ? `context:\n${context.map((s: string) => `  - ${s}`).join("\n")}\n`
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
${roleLine}${scopeLines}${contextLines}${dependsOnLines}created: ${today}
updated: ${today}
---
${bodyContent}
`;

    const MAX_SLUG_LENGTH = 50;
    const slug = generateSlug(sanitizedTitle, MAX_SLUG_LENGTH);

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
