import { NextResponse } from "next/server";
import type { TaskFrontmatter } from "@/parser/parser";
import { getErrorMessage } from "@/lib/error-utils";
import {
  getAllTasks,
  createTask,
  getNextTaskId,
  parseScope,
  parseDependsOn,
} from "@/service/task-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = getAllTasks();
  const tasks: TaskFrontmatter[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status as TaskFrontmatter["status"],
    priority: row.priority as TaskFrontmatter["priority"],
    depends_on: parseDependsOn(row),
    blocks: [],
    parallel_with: [],
    role: row.role ?? "",
    affected_files: parseScope(row),
  }));
  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, priority, role, depends_on, scope } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const validPriorities = ["critical", "high", "medium", "low"];
    const taskPriority = validPriorities.includes(priority)
      ? priority
      : "medium";

    const taskId = getNextTaskId();
    const sanitizedTitle = title.trim();
    const taskRole = role && typeof role === "string" ? role.trim() : "general";

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

    createTask({
      id: taskId,
      title: sanitizedTitle,
      status: "pending",
      priority: taskPriority,
      role: taskRole,
      depends_on: depsArray,
      scope: scopeArray,
    });

    return NextResponse.json(
      {
        id: taskId,
        title: sanitizedTitle,
        status: "pending",
        priority: taskPriority,
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
