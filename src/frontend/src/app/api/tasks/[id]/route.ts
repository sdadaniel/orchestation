import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/error-utils";
import { getTask, updateTask, deleteTask, parseDependsOn, parseScope } from "@/service/task-store";

export const dynamic = "force-dynamic";

const TASK_ID_PATTERN = /^TASK-\d{3}$/;

function isValidTaskId(taskId: string): boolean {
  return TASK_ID_PATTERN.test(taskId);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id || typeof id !== "string" || !isValidTaskId(id)) {
      return NextResponse.json({ error: "Invalid task ID format" }, { status: 400 });
    }

    const task = getTask(id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const validStatuses = ["pending", "stopped", "in_progress", "reviewing", "done", "failed", "rejected"];
    const validPriorities = ["critical", "high", "medium", "low"];

    const updates: Parameters<typeof updateTask>[1] = {};

    if (body.status !== undefined) {
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status: ${body.status}` },
          { status: 400 },
        );
      }

      // Dependency validation: in_progress requires all depends_on tasks to be done
      if (body.status === "in_progress") {
        const deps = parseDependsOn(task);
        if (deps.length > 0) {
          const unmetDeps: { id: string; status: string }[] = [];
          for (const depId of deps) {
            if (!depId.trim()) continue;
            const depTask = getTask(depId.trim());
            if (!depTask) {
              unmetDeps.push({ id: depId, status: "not found" });
              continue;
            }
            if (depTask.status !== "done") {
              unmetDeps.push({ id: depId, status: depTask.status || "unknown" });
            }
          }
          if (unmetDeps.length > 0) {
            const details = unmetDeps.map((d) => `${d.id} (status: ${d.status})`).join(", ");
            return NextResponse.json(
              { error: `의존성 미충족: 선행 태스크가 완료되지 않았습니다 - ${details}` },
              { status: 400 },
            );
          }
        }
      }
      updates.status = body.status;
    }

    if (body.priority !== undefined) {
      if (!validPriorities.includes(body.priority)) {
        return NextResponse.json(
          { error: `Invalid priority: ${body.priority}` },
          { status: 400 },
        );
      }
      updates.priority = body.priority;
    }

    if (body.depends_on !== undefined) {
      if (!Array.isArray(body.depends_on)) {
        return NextResponse.json(
          { error: "depends_on must be an array" },
          { status: 400 },
        );
      }
      updates.depends_on = body.depends_on.filter(
        (d: unknown) => typeof d === "string" && d.trim().length > 0,
      );
    }

    if (body.role !== undefined && typeof body.role === "string") {
      updates.role = body.role.trim();
    }

    if (body.title !== undefined && typeof body.title === "string" && body.title.trim().length > 0) {
      updates.title = body.title.trim();
    }

    updateTask(id, updates);

    const updated = getTask(id)!;
    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      status: updated.status,
      priority: updated.priority,
      depends_on: parseDependsOn(updated),
      role: updated.role || "",
      affected_files: parseScope(updated),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: getErrorMessage(err, "Failed to update task"),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string" || !isValidTaskId(id)) {
      return NextResponse.json({ error: "Invalid task ID format" }, { status: 400 });
    }

    const task = getTask(id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const deleted = deleteTask(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete task" },
        { status: 500 },
      );
    }

    return NextResponse.json({ deleted: id });
  } catch (err) {
    return NextResponse.json(
      {
        error: getErrorMessage(err, "Failed to delete task"),
      },
      { status: 500 },
    );
  }
}
