import { NextResponse } from "next/server";
import fs from "fs";
import { getErrorMessage } from "@/lib/error-utils";
import { ROLES_DIR } from "@/lib/paths";
import { getDb, isDbAvailable } from "@/service/db";
import { getNextTaskId, createTask } from "@/service/task-store";
import { formatTimestamp } from "@/lib/date-utils";

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
    const rows = db
      .prepare(
        "SELECT id, title, status, priority, created, updated, content, depends_on, scope, sort_order, branch FROM tasks ORDER BY id",
      )
      .all() as RequestRow[];

    const statusOrder: Record<string, number> = {
      pending: 0,
      reviewing: 1,
      in_progress: 2,
      rejected: 3,
      done: 4,
    };
    const requests = rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
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

  return NextResponse.json([]);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, content, priority, scope, context, depends_on, role } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const validPriorities = ["high", "medium", "low"];
    const taskPriority = validPriorities.includes(priority)
      ? priority
      : "medium";

    const taskId = getNextTaskId();
    const sanitizedTitle = title.trim();
    const bodyContent =
      content && typeof content === "string" ? content.trim() : "";

    const now = new Date();
    const today = formatTimestamp(now);

    let validRoles: string[];
    try {
      validRoles = fs
        .readdirSync(ROLES_DIR)
        .filter(
          (f) =>
            f.endsWith(".md") &&
            !f.startsWith("reviewer-") &&
            f !== "README.md",
        )
        .map((f) => f.replace(".md", ""));
    } catch {
      validRoles = ["general"];
    }
    const taskRole =
      typeof role === "string" && validRoles.includes(role) ? role : "";

    createTask({
      id: taskId,
      title: sanitizedTitle,
      status: "pending",
      priority: taskPriority,
      role: taskRole || "general",
      scope: Array.isArray(scope) ? scope : [],
      context: Array.isArray(context) ? context : [],
      depends_on: Array.isArray(depends_on) ? depends_on : [],
      content: bodyContent,
    });

    return NextResponse.json(
      {
        id: taskId,
        title: sanitizedTitle,
        status: "pending",
        priority: taskPriority,
        created: today,
        updated: today,
        content: bodyContent,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to create task") },
      { status: 500 },
    );
  }
}
