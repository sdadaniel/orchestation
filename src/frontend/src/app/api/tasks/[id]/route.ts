import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

export const dynamic = "force-dynamic";

const TASKS_DIR = path.join(process.cwd(), "../../docs/task");

function findTaskFile(taskId: string): string | null {
  if (!fs.existsSync(TASKS_DIR)) return null;
  const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    if (file.startsWith(taskId)) {
      return path.join(TASKS_DIR, file);
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

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
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
        error: err instanceof Error ? err.message : "Failed to update task",
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

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    const filePath = findTaskFile(id);
    if (!filePath) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    fs.unlinkSync(filePath);

    // Also remove from any sprint files
    const sprintsDir = path.join(process.cwd(), "../../docs/sprint");
    if (fs.existsSync(sprintsDir)) {
      const sprintFiles = fs
        .readdirSync(sprintsDir)
        .filter((f) => f.startsWith("SPRINT-") && f.endsWith(".md"));

      for (const sf of sprintFiles) {
        const sfPath = path.join(sprintsDir, sf);
        const content = fs.readFileSync(sfPath, "utf-8");
        const regex = new RegExp(`^- ${id}[:\\s].*$`, "gm");
        if (regex.test(content)) {
          const updated = content.replace(regex, "").replace(/\n{3,}/g, "\n\n");
          fs.writeFileSync(sfPath, updated, "utf-8");
        }
      }
    }

    return NextResponse.json({ deleted: id });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to delete task",
      },
      { status: 500 },
    );
  }
}
