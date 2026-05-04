import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors/error-utils";
import { ROLES_DIR } from "@/lib/config/paths";
import { getDb, isDbAvailable } from "@/service/db";
import {
  getAllTasks,
  createTask,
  getNextTaskId,
  getTaskDisplayId,
} from "@/service/task-store";
import fs from "fs";
import { formatTimestamp } from "@/lib/time/date-utils";

export const dynamic = "force-dynamic";

type TaskListRow = {
  id: string;
  display_id: string | null;
  title: string;
  status: string;
  phase: string | null;
  priority: string;
  created: string | null;
  updated: string | null;
};

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  if (!isDbAvailable()) {
    return NextResponse.json({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });
  }

  const db = getDb()!;
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const size = parsePositiveInt(searchParams.get("size"), 20);
  const summary = searchParams.get("summary") === "1";
  const offset = (page - 1) * size;

  const totalRow = db.prepare(
    "SELECT COUNT(*) AS count FROM tasks",
  ).get() as { count?: number } | undefined;

  const rows = db.prepare(
    `SELECT id, display_id, title, status, phase, priority, created, updated
       FROM tasks
      ORDER BY sort_order, COALESCE(display_number, 2147483647), display_id, id
      LIMIT ? OFFSET ?`,
  ).all(size, offset) as TaskListRow[];

  const items = rows.map((row) => ({
    id: row.id,
    display_id: getTaskDisplayId(row),
    title: row.title,
    status: row.status,
    phase: row.phase,
    priority: row.priority,
    created: row.created ?? "",
    updated: row.updated ?? "",
  }));

  if (summary) {
    const fullRows = getAllTasks().map((row) => ({
      id: row.id,
      display_id: getTaskDisplayId(row),
      title: row.title,
      status: row.status,
      created: row.created ?? "",
      updated: row.updated ?? "",
    }));
    const summarySorted = [...fullRows].sort((a, b) => {
      const statusWeight = (status: string) => {
        switch (status) {
          case "in_progress":
            return 0;
          case "reviewing":
            return 1;
          case "pending":
            return 2;
          case "stopped":
            return 3;
          default:
            return 4;
        }
      };
      const weightDiff = statusWeight(a.status) - statusWeight(b.status);
      if (weightDiff !== 0) return weightDiff;
      return (b.updated || b.created).localeCompare(a.updated || a.created);
    });
    const total = fullRows.length;
    const start = (page - 1) * size;
    return NextResponse.json({
      items: summarySorted.slice(start, start + size),
      total,
      page,
      size,
      counts: {
        pending: fullRows.filter((row) => row.status === "pending").length,
        reviewing: fullRows.filter((row) => row.status === "reviewing").length,
        in_progress: fullRows.filter((row) => row.status === "in_progress").length,
        failed: fullRows.filter((row) => row.status === "failed").length,
        rejected: fullRows.filter((row) => row.status === "rejected").length,
        done: fullRows.filter((row) => row.status === "done").length,
        stopped: fullRows.filter((row) => row.status === "stopped").length,
        total,
      },
      active: fullRows.filter((row) => row.status === "in_progress"),
      pending: fullRows.filter(
        (row) => row.status === "pending" || row.status === "reviewing",
      ),
    });
  }

  return NextResponse.json({
    items,
    total: totalRow?.count ?? 0,
    page,
    size,
  });
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

    const depsArray = Array.isArray(depends_on)
      ? depends_on.filter(
          (d: unknown) => typeof d === "string" && d.trim().length > 0,
        )
      : [];

    const scopeArray = Array.isArray(scope)
      ? scope.filter(
          (s: unknown) => typeof s === "string" && s.trim().length > 0,
        )
      : [];

    const created = createTask({
      display_id: taskId,
      title: sanitizedTitle,
      status: "pending",
      priority: taskPriority,
      role: taskRole || "general",
      depends_on: depsArray,
      scope: scopeArray,
      context: Array.isArray(context) ? context : [],
      content: bodyContent,
    });

    return NextResponse.json(
      {
        id: created.id,
        display_id: getTaskDisplayId(created),
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
      {
        error: getErrorMessage(err, "Failed to create task"),
      },
      { status: 500 },
    );
  }
}
