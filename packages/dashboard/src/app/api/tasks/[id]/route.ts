import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getErrorMessage } from "@/lib/errors/error-utils";
import { OUTPUT_DIR } from "@/lib/config/paths";
import { parseDependsOn, parseScope } from "@/lib/task-row-parsers";
import { parseWorkflowFromTaskContent } from "@/lib/workflow";
import {
  getTask,
  getAllTasks,
  getTaskSteps,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskDisplayId,
  getTaskLookupKeys,
  resolveTaskRef,
} from "@/service/task-store";

export const dynamic = "force-dynamic";

const TASK_ID_PATTERN = /^[A-Za-z0-9][\w-]*$/;

function isValidTaskId(taskId: string): boolean {
  return TASK_ID_PATTERN.test(taskId);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resolved = resolveTaskRef(id);
  const task = resolved?.task ?? null;

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let executionLog: Record<string, unknown> | null = null;
  for (const taskKey of getTaskLookupKeys(task)) {
    const taskJsonPath = path.join(OUTPUT_DIR, `${taskKey}-task.json`);
    if (!fs.existsSync(taskJsonPath)) continue;
    try {
      executionLog = JSON.parse(fs.readFileSync(taskJsonPath, "utf-8"));
      break;
    } catch {
      /* ignore */
    }
  }

  let reviewResult: Record<string, unknown> | null = null;
  for (const taskKey of getTaskLookupKeys(task)) {
    const reviewJsonPath = path.join(OUTPUT_DIR, `${taskKey}-review.json`);
    if (!fs.existsSync(reviewJsonPath)) continue;
    try {
      reviewResult = JSON.parse(fs.readFileSync(reviewJsonPath, "utf-8"));
      break;
    } catch {
      /* ignore */
    }
  }

  let costEntries: {
    phase: string;
    cost: string;
    duration: string;
    tokens: string;
  }[] = [];
  const tokenLogPath = path.join(OUTPUT_DIR, "token-usage.log");
  if (fs.existsSync(tokenLogPath)) {
    try {
      const lookupKeys = getTaskLookupKeys(task);
      const lines = fs
        .readFileSync(tokenLogPath, "utf-8")
        .split("\n")
        .filter(
          (l) =>
            lookupKeys.some((taskKey) => l.includes(taskKey)) &&
            !l.includes("model_selection"),
        );
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
    .map((t) => ({
      id: t.id,
      display_id: getTaskDisplayId(t),
      title: t.title,
      status: t.status,
    }));
  const dependsOnResolved = dependsOnIds.map((depId) => {
    const dep = allTasks.find((t) => t.id === depId || t.display_id === depId);
    return dep
      ? { id: dep.id, display_id: getTaskDisplayId(dep), title: dep.title, status: dep.status }
      : { id: depId, display_id: depId, title: "", status: "unknown" };
  });

  const workflowDefs = parseWorkflowFromTaskContent(task.content ?? "");
  const workflowRows = getTaskSteps(task.id);
  const rowByKey = new Map(workflowRows.map((r) => [r.step_key, r]));
  const workflowSteps = workflowDefs.map((def) => {
    const row = rowByKey.get(def.key);
    return {
      key: def.key,
      type: def.type,
      status: row?.status ?? "pending",
      attempt: row?.attempt ?? 0,
      maxAttempts: row?.max_attempts ?? null,
      startedAt: row?.started_at ?? null,
      finishedAt: row?.finished_at ?? null,
    };
  });

  const currentStep =
    workflowSteps.find((s) => s.status === "in_progress") ??
    workflowSteps.find((s) => s.status === "pending") ??
    workflowSteps[workflowSteps.length - 1] ??
    null;

  return NextResponse.json({
    id: task.id,
    display_id: getTaskDisplayId(task),
    title: task.title,
    status: task.status,
    phase: task.phase ?? null,
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
    workflow: {
      steps: workflowSteps,
      currentStepKey: currentStep?.key ?? null,
      currentStepType: currentStep?.type ?? null,
    },
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id || typeof id !== "string" || !isValidTaskId(id)) {
      return NextResponse.json(
        { error: "Invalid task ID format" },
        { status: 400 },
      );
    }

    const task = getTask(id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

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
    if (body.depends_on !== undefined && Array.isArray(body.depends_on)) {
      fieldUpdates.depends_on = body.depends_on.filter(
        (d: unknown) => typeof d === "string" && d.trim().length > 0,
      );
    }
    if (body.role !== undefined && typeof body.role === "string") {
      fieldUpdates.role = body.role.trim();
    }

    if (Object.keys(fieldUpdates).length > 0) {
      updateTask(id, fieldUpdates);
    }

    return NextResponse.json(getTask(id) || { ok: true });
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
      return NextResponse.json(
        { error: "Invalid task ID format" },
        { status: 400 },
      );
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
