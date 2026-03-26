import { NextResponse } from "next/server";
import { parseAllTasks } from "@/lib/parser";
import fs from "fs";
import path from "path";
import { TASKS_DIR } from "@/lib/paths";
import { generateNextTaskId } from "@/lib/task-id";
import { getErrorMessage } from "@/lib/error-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const tasks = parseAllTasks();
  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, priority, role, depends_on, sprint, scope } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 },
      );
    }

    const validPriorities = ["critical", "high", "medium", "low"];
    const taskPriority = validPriorities.includes(priority)
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
    const taskSprint =
      sprint && typeof sprint === "string" ? sprint.trim() : "";

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

    const content = `---
id: ${taskId}
title: ${sanitizedTitle}
status: pending
priority: ${taskPriority}
sprint: ${taskSprint}
depends_on:${depsYaml}
role: ${taskRole}${scopeYaml}
---

# ${taskId}: ${sanitizedTitle}

## 목표

TBD

## 완료 조건

- [ ] TBD
`;

    const filePath = path.join(TASKS_DIR, `${taskId}-${sanitizedTitle.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/-+$/, "")}.md`);
    fs.writeFileSync(filePath, content, "utf-8");

    // If sprint is specified, add task to sprint file
    if (taskSprint) {
      const sprintFile = path.join(
        process.cwd(),
        "../../docs/sprint",
        `${taskSprint}.md`,
      );
      if (fs.existsSync(sprintFile)) {
        let sprintContent = fs.readFileSync(sprintFile, "utf-8");
        // Find the last batch section and append the task
        const lastBatchMatch = sprintContent.match(/### .+(?![\s\S]*###)/);
        if (lastBatchMatch && lastBatchMatch.index !== undefined) {
          sprintContent =
            sprintContent.trimEnd() +
            `\n- ${taskId}: ${sanitizedTitle}\n`;
        } else {
          sprintContent =
            sprintContent.trimEnd() +
            `\n\n### 배치 0\n- ${taskId}: ${sanitizedTitle}\n`;
        }
        fs.writeFileSync(sprintFile, sprintContent, "utf-8");
      }
    }

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
        error:
          getErrorMessage(err, "Failed to create task"),
      },
      { status: 500 },
    );
  }
}
