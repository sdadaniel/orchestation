import { NextResponse } from "next/server";
import { parseAllTasks } from "@/lib/parser";
import type { TaskFrontmatter } from "@/lib/parser";
import fs from "fs";
import path from "path";
import { TASKS_DIR } from "@/lib/paths";
import { generateNextTaskId } from "@/lib/task-id";
import { getErrorMessage } from "@/lib/error-utils";
import { renderTemplate } from "@/lib/template";
import { generateSlug } from "@/lib/slug-utils";
import { getDb, isDbAvailable } from "@/lib/db";
import { syncAllTaskFilesToDb, syncTaskFileToDb } from "@/lib/task-db-sync";
import { VALID_PRIORITIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  depends_on: string | null;
  role: string | null;
  scope: string | null;
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
  syncAllTaskFilesToDb();
  if (isDbAvailable()) {
    const db = getDb()!;
    const rows = db.prepare("SELECT id, title, status, priority, depends_on, role, scope FROM tasks ORDER BY id").all() as TaskRow[];
    const tasks: TaskFrontmatter[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status as TaskFrontmatter["status"],
      priority: row.priority as TaskFrontmatter["priority"],
      depends_on: parseJsonArray(row.depends_on),
      blocks: [],
      parallel_with: [],
      role: row.role ?? "",
      affected_files: parseJsonArray(row.scope),
    }));
    return NextResponse.json(tasks);
  }

  const tasks = parseAllTasks();
  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, priority, role, depends_on, scope } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 },
      );
    }

    const taskPriority = (VALID_PRIORITIES as readonly string[]).includes(priority)
      ? priority
      : "medium";

    if (!fs.existsSync(TASKS_DIR)) {
      fs.mkdirSync(TASKS_DIR, { recursive: true });
    }

    // Determine next task ID
    const taskId = generateNextTaskId(TASKS_DIR);
    const sanitizedTitle = title.trim();
    const taskRole =
      role && typeof role === "string" ? role.trim() : "general";

    const depsArray = Array.isArray(depends_on)
      ? depends_on.filter(
          (d: unknown) => typeof d === "string" && d.trim().length > 0,
        )
      : [];

    const depsYaml =
      depsArray.length > 0
        ? `\n${depsArray.map((d: string) => `    - ${d}`).join("\n")}`
        : " []";

    const scopeArray = Array.isArray(scope)
      ? scope.filter(
          (s: unknown) => typeof s === "string" && s.trim().length > 0,
        )
      : [];
    const scopeYaml =
      scopeArray.length > 0
        ? `\nscope:\n${scopeArray.map((s: string) => `  - ${s}`).join("\n")}`
        : "";

    const content = renderTemplate("entity/task.md", {
      task_id: taskId,
      title: sanitizedTitle,
      priority: taskPriority,
      depends_on_yaml: depsYaml,
      role: taskRole,
      scope_yaml: scopeYaml,
    });

    const slug = generateSlug(sanitizedTitle);
    const filePath = path.join(TASKS_DIR, `${taskId}-${slug}.md`);
    fs.writeFileSync(filePath, content, "utf-8");
    syncTaskFileToDb(filePath);

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
