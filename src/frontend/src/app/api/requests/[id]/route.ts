import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { findRequestFile, parseRequestFile, parseAllRequests, getRequestsDir } from "@/lib/request-parser";
import { getErrorMessage } from "@/lib/error-utils";
import { OUTPUT_DIR } from "@/lib/paths";
import { generateSlug } from "@/lib/slug-utils";
import { deleteTask } from "@/service/task-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const filePath = findRequestFile(id);

  if (!filePath) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const data = parseRequestFile(filePath);
  if (!data) {
    return NextResponse.json({ error: "Failed to parse request" }, { status: 500 });
  }

  const taskId = id;

  // Check for execution log
  let executionLog: Record<string, unknown> | null = null;
  const taskJsonPath = path.join(OUTPUT_DIR, `${taskId}-task.json`);
  if (fs.existsSync(taskJsonPath)) {
    try {
      executionLog = JSON.parse(fs.readFileSync(taskJsonPath, "utf-8"));
    } catch { /* ignore */ }
  }

  // Check for review result
  let reviewResult: Record<string, unknown> | null = null;
  const reviewJsonPath = path.join(OUTPUT_DIR, `${taskId}-review.json`);
  if (fs.existsSync(reviewJsonPath)) {
    try {
      reviewResult = JSON.parse(fs.readFileSync(reviewJsonPath, "utf-8"));
    } catch { /* ignore */ }
  }

  // Get cost info from token-usage.log
  let costEntries: { phase: string; cost: string; duration: string; tokens: string }[] = [];
  const tokenLogPath = path.join(OUTPUT_DIR, "token-usage.log");
  if (fs.existsSync(tokenLogPath)) {
    try {
      const logContent = fs.readFileSync(tokenLogPath, "utf-8");
      const lines = logContent.split("\n").filter((l) => l.includes(taskId) && !l.includes("model_selection"));
      costEntries = lines.map((line) => {
        const phase = line.match(/phase=(\w+)/)?.[1] || "unknown";
        const cost = line.match(/cost=\$([0-9.]+)/)?.[1] || "0";
        const duration = line.match(/duration=(\d+)ms/)?.[1] || "0";
        const output = line.match(/output=(\d+)/)?.[1] || "0";
        const input = line.match(/input=(\d+)/)?.[1] || "0";
        return { phase, cost: `$${parseFloat(cost).toFixed(4)}`, duration: `${(parseInt(duration) / 1000).toFixed(1)}s`, tokens: `in:${input} out:${output}` };
      });
    } catch { /* ignore */ }
  }

  // Find tasks that depend on this task (blocked_by this task)
  const allTasks = parseAllRequests();
  const dependedBy = allTasks
    .filter((t) => t.depends_on.includes(data.id))
    .map((t) => ({ id: t.id, title: t.title, status: t.status }));

  // Resolve depends_on with title and status
  const dependsOnResolved = data.depends_on.map((depId) => {
    const dep = allTasks.find((t) => t.id === depId);
    return dep ? { id: dep.id, title: dep.title, status: dep.status } : { id: depId, title: "", status: "unknown" };
  });

  return NextResponse.json({
    ...data,
    depends_on: data.depends_on,
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
  const filePath = findRequestFile(id);

  if (!filePath) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const existing = fs.readFileSync(filePath, "utf-8");

    const fmMatch = existing.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      return NextResponse.json({ error: "Invalid file format" }, { status: 500 });
    }

    let fm = fmMatch[1];
    const oldContent = existing.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();

    // Update frontmatter fields if provided
    if (body.status && ["pending", "in_progress", "reviewing", "done", "rejected", "stopped", "failed"].includes(body.status)) {
      // Dependency validation: in_progress requires all depends_on tasks to be done
      if (body.status === "in_progress") {
        const currentData = parseRequestFile(filePath);
        if (currentData && currentData.depends_on.length > 0) {
          const allTasks = parseAllRequests();
          const unmetDeps = currentData.depends_on.filter((depId) => {
            const dep = allTasks.find((t) => t.id === depId);
            return !dep || dep.status !== "done";
          });
          if (unmetDeps.length > 0) {
            const details = unmetDeps.map((depId) => {
              const dep = allTasks.find((t) => t.id === depId);
              return dep ? `${depId} (status: ${dep.status})` : `${depId} (not found)`;
            });
            return NextResponse.json(
              { error: `의존성 미충족: 선행 태스크가 완료되지 않았습니다 - ${details.join(", ")}` },
              { status: 400 },
            );
          }
        }
      }
      fm = fm.replace(/^status:\s*.+$/m, `status: ${body.status}`);
    }
    if (body.title && typeof body.title === "string") {
      fm = fm.replace(/^title:\s*.+$/m, `title: ${body.title.trim()}`);
    }
    if (body.priority && ["high", "medium", "low"].includes(body.priority)) {
      fm = fm.replace(/^priority:\s*.+$/m, `priority: ${body.priority}`);
    }

    // Update the updated timestamp
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    if (fm.match(/^updated:\s*.+$/m)) {
      fm = fm.replace(/^updated:\s*.+$/m, `updated: ${now}`);
    } else {
      fm += `\nupdated: ${now}`;
    }

    const newContent = body.content !== undefined ? body.content.trim() : oldContent;
    const fileContent = `---\n${fm}\n---\n${newContent}\n`;

    // If title changed, rename file
    if (body.title && typeof body.title === "string") {
      const slug = generateSlug(body.title.trim());
      const newPath = `${getRequestsDir()}/${id}-${slug}.md`;
      fs.writeFileSync(newPath, fileContent, "utf-8");
      if (newPath !== filePath) {
        fs.unlinkSync(filePath);
      }
      // DB is source of truth — file write is for legacy compat only
    } else {
      fs.writeFileSync(filePath, fileContent, "utf-8");
      // DB is source of truth — file write is for legacy compat only
    }

    // Return updated data
    const updated = body.title
      ? parseRequestFile(`${getRequestsDir()}/${id}-${generateSlug(body.title.trim())}.md`)
      : parseRequestFile(filePath);

    return NextResponse.json(updated || { ok: true });
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
  const filePath = findRequestFile(id);

  if (!filePath) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  try {
    fs.unlinkSync(filePath);
    deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to delete") },
      { status: 500 },
    );
  }
}
