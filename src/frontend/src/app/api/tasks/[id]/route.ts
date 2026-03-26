import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { getErrorMessage } from "@/lib/error-utils";
import { TASKS_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

const TASK_ID_PATTERN = /^TASK-\d{3}$/;

function isValidTaskId(taskId: string): boolean {
  return TASK_ID_PATTERN.test(taskId);
}

function findTaskFile(taskId: string): string | null {
  if (!fs.existsSync(TASKS_DIR)) return null;
  const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    if (file.startsWith(taskId)) {
      const resolved = path.resolve(TASKS_DIR, file);
      // Path traversal 방어: resolve된 경로가 TASKS_DIR 내부인지 확인
      if (!resolved.startsWith(TASKS_DIR + path.sep) && resolved !== TASKS_DIR) {
        return null;
      }
      return resolved;
    }
  }
  return null;
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

    const filePath = findTaskFile(id);
    if (!filePath) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const { data, content: markdownBody } = matter(content);

    const validStatuses = ["pending", "in_progress", "in_review", "done"];
    const validPriorities = ["critical", "high", "medium", "low"];

    if (body.status !== undefined) {
      if (validStatuses.includes(body.status)) {
        // Dependency validation: in_progress requires all depends_on tasks to be done
        if (body.status === "in_progress" && Array.isArray(data.depends_on) && data.depends_on.length > 0) {
          const unmetDeps: { id: string; status: string }[] = [];
          for (const depId of data.depends_on) {
            if (typeof depId !== "string" || !depId.trim()) continue;
            const depFile = findTaskFile(depId.trim());
            if (!depFile) {
              unmetDeps.push({ id: depId, status: "not found" });
              continue;
            }
            const depContent = fs.readFileSync(depFile, "utf-8");
            const depData = matter(depContent).data;
            if (depData.status !== "done") {
              unmetDeps.push({ id: depId, status: depData.status || "unknown" });
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
        data.status = body.status;
      } else {
        return NextResponse.json(
          { error: `Invalid status: ${body.status}` },
          { status: 400 },
        );
      }
    }

    if (body.priority !== undefined) {
      if (validPriorities.includes(body.priority)) {
        data.priority = body.priority;
      } else {
        return NextResponse.json(
          { error: `Invalid priority: ${body.priority}` },
          { status: 400 },
        );
      }
    }

    if (body.depends_on !== undefined) {
      if (Array.isArray(body.depends_on)) {
        data.depends_on = body.depends_on.filter(
          (d: unknown) => typeof d === "string" && d.trim().length > 0,
        );
      } else {
        return NextResponse.json(
          { error: "depends_on must be an array" },
          { status: 400 },
        );
      }
    }

    if (body.role !== undefined && typeof body.role === "string") {
      data.role = body.role.trim();
    }

    if (body.title !== undefined && typeof body.title === "string" && body.title.trim().length > 0) {
      data.title = body.title.trim();
    }

    const updated = matter.stringify(markdownBody, data);
    fs.writeFileSync(filePath, updated, "utf-8");

    return NextResponse.json({
      id: data.id,
      title: data.title,
      status: data.status,
      priority: data.priority,
      depends_on: data.depends_on || [],
      role: data.role || "",
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

    const filePath = findTaskFile(id);
    if (!filePath) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Step 1: Remove task from sprint files FIRST (before deleting the task file)
    // This ensures that if sprint modification fails, the task file remains intact.
    const sprintsDir = path.join(process.cwd(), "../../docs/sprint");
    if (fs.existsSync(sprintsDir)) {
      const sprintFiles = fs
        .readdirSync(sprintsDir)
        .filter((f) => f.startsWith("SPRINT-") && f.endsWith(".md"));

      const modifiedSprints: { path: string; original: string }[] = [];
      try {
        for (const sf of sprintFiles) {
          const sfPath = path.join(sprintsDir, sf);
          const content = fs.readFileSync(sfPath, "utf-8");
          const regex = new RegExp(`^- ${id}[:\\s].*$`, "gm");
          if (regex.test(content)) {
            modifiedSprints.push({ path: sfPath, original: content });
            const updated = content
              .replace(regex, "")
              .replace(/\n{3,}/g, "\n\n");
            fs.writeFileSync(sfPath, updated, "utf-8");
          }
        }
      } catch (sprintErr) {
        // Rollback any sprint files that were already modified
        for (const modified of modifiedSprints) {
          try {
            fs.writeFileSync(modified.path, modified.original, "utf-8");
          } catch {
            // Best-effort rollback
          }
        }
        return NextResponse.json(
          {
            error:
              getErrorMessage(sprintErr, "Failed to update sprint files"),
          },
          { status: 500 },
        );
      }
    }

    // Step 2: Delete the task file after sprint files are updated successfully.
    // If this fails, sprint files are already updated (task reference removed),
    // which is a safe state — the caller can retry the delete.
    try {
      fs.unlinkSync(filePath);
    } catch (deleteErr) {
      return NextResponse.json(
        {
          error:
            getErrorMessage(deleteErr, "Failed to delete task file (sprint files already updated, retry is safe)"),
        },
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
