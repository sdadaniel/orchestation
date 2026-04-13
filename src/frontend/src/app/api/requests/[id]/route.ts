import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getErrorMessage } from "@/lib/error-utils";
import { OUTPUT_DIR } from "@/lib/paths";
import {
  getTask,
  getAllTasks,
  updateTask,
  updateTaskStatus,
  deleteTask,
  parseScope,
  parseDependsOn,
} from "@/service/task-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);

  if (!task) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Execution log (file-based, remains in OUTPUT_DIR)
  let executionLog: Record<string, unknown> | null = null;
  const taskJsonPath = path.join(OUTPUT_DIR, `${id}-task.json`);
  if (fs.existsSync(taskJsonPath)) {
    try {
      executionLog = JSON.parse(fs.readFileSync(taskJsonPath, "utf-8"));
    } catch {
      /* ignore */
    }
  }

  // Review result
  let reviewResult: Record<string, unknown> | null = null;
  const reviewJsonPath = path.join(OUTPUT_DIR, `${id}-review.json`);
  if (fs.existsSync(reviewJsonPath)) {
    try {
      reviewResult = JSON.parse(fs.readFileSync(reviewJsonPath, "utf-8"));
    } catch {
      /* ignore */
    }
  }

  // Cost info from token-usage.log
  let costEntries: {
    phase: string;
    cost: string;
    duration: string;
    tokens: string;
  }[] = [];
  const tokenLogPath = path.join(OUTPUT_DIR, "token-usage.log");
  if (fs.existsSync(tokenLogPath)) {
    try {
      const lines = fs
        .readFileSync(tokenLogPath, "utf-8")
        .split("\n")
        .filter((l) => l.includes(id) && !l.includes("model_selection"));
      costEntries = lines.map((line) => ({
        phase: line.match(/phase=(\w+)/)?.[1] || "unknown",
        cost: `$${parseFloat(line.match(/cost=\$([0-9.]+)/)?.[1] || "0").toFixed(4)}`,
        duration: `${(parseInt(line.match(/duration=(\d+)ms/)?.[1] || "0") / 1000).toFixed(1)}s`,
        tokens: `in:${line.match(/input=(\d+)/)?.[1] || "0"} out:${line.match(/output=(\d+)/)?.[1] || "0"}`,
      }));
    } catch {
      /* ignore */
    }
  }

  const allTasks = getAllTasks();
  const dependsOnIds = parseDependsOn(task);
  const dependedBy = allTasks
    .filter((t) => parseDependsOn(t).includes(task.id))
    .map((t) => ({ id: t.id, title: t.title, status: t.status }));
  const dependsOnResolved = dependsOnIds.map((depId) => {
    const dep = allTasks.find((t) => t.id === depId);
    return dep
      ? { id: dep.id, title: dep.title, status: dep.status }
      : { id: depId, title: "", status: "unknown" };
  });

  return NextResponse.json({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority ?? "medium",
    created: task.created ?? "",
    updated: task.updated ?? "",
    content: task.content ?? "",
    depends_on: dependsOnIds,
    scope: parseScope(task),
    sort_order: task.sort_order ?? 0,
    branch: task.branch ?? "",
    depends_on_detail: dependsOnResolved,
    depended_by: dependedBy,
    executionLog,
    reviewResult,
    costEntries,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  try {
    const body = await request.json();

    // Dependency validation for in_progress
    if (body.status === "in_progress") {
      const dependsOnIds = parseDependsOn(task);
      if (dependsOnIds.length > 0) {
        const allTasks = getAllTasks();
        const unmetDeps = dependsOnIds.filter((depId) => {
          const dep = allTasks.find((t) => t.id === depId);
          return !dep || dep.status !== "done";
        });
        if (unmetDeps.length > 0) {
          const details = unmetDeps.map((depId) => {
            const dep = allTasks.find((t) => t.id === depId);
            return dep
              ? `${depId} (status: ${dep.status})`
              : `${depId} (not found)`;
          });
          return NextResponse.json(
            {
              error: `의존성 미충족: 선행 태스크가 완료되지 않았습니다 - ${details.join(", ")}`,
            },
            { status: 400 },
          );
        }
      }
    }

    const validStatuses = [
      "pending",
      "in_progress",
      "reviewing",
      "done",
      "rejected",
      "stopped",
      "failed",
    ];
    if (body.status && validStatuses.includes(body.status)) {
      updateTaskStatus(id, body.status, task.status);
    }

    const fieldUpdates: Parameters<typeof updateTask>[1] = {};
    if (body.title && typeof body.title === "string")
      fieldUpdates.title = body.title.trim();
    if (body.priority && ["high", "medium", "low"].includes(body.priority))
      fieldUpdates.priority = body.priority;
    if (body.content !== undefined)
      fieldUpdates.content = String(body.content).trim();

    if (Object.keys(fieldUpdates).length > 0) {
      updateTask(id, fieldUpdates);
    }

    return NextResponse.json(getTask(id) || { ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to update") },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  try {
    deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to delete") },
      { status: 500 },
    );
  }
}
