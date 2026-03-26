import { NextResponse } from "next/server";
import { parseAllSprints } from "@/lib/sprint-parser";
import { getErrorMessage } from "@/lib/error-utils";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const SPRINTS_DIR = path.join(process.cwd(), "../../docs/sprint");

export async function GET() {
  const sprints = parseAllSprints();
  return NextResponse.json(sprints);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, goal, status } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 },
      );
    }

    const validStatuses = ["ready", "in_progress", "done"];
    const sprintStatus =
      validStatuses.includes(status) ? status : "ready";

    // Determine next sprint ID
    if (!fs.existsSync(SPRINTS_DIR)) {
      fs.mkdirSync(SPRINTS_DIR, { recursive: true });
    }

    const existingFiles = fs
      .readdirSync(SPRINTS_DIR)
      .filter((f) => f.startsWith("SPRINT-") && f.endsWith(".md"));

    let maxNum = 0;
    for (const f of existingFiles) {
      const m = f.match(/SPRINT-(\d+)\.md/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    const sprintId = `SPRINT-${String(nextNum).padStart(3, "0")}`;

    const sanitizedTitle = title.trim();
    const sanitizedGoal =
      goal && typeof goal === "string" ? goal.trim() : "";

    const content = `---
status: ${sprintStatus}
---

# Sprint ${nextNum}: ${sanitizedTitle}

## ${"\uBAA9\uD45C"}

${sanitizedGoal ? `- ${sanitizedGoal}` : "- TBD"}

## ${"\uD3EC\uD568"} Task

### ${"\uBC30\uCE58"} 0
`;

    const filePath = path.join(SPRINTS_DIR, `${sprintId}.md`);
    fs.writeFileSync(filePath, content, "utf-8");

    return NextResponse.json(
      { id: sprintId, title: sanitizedTitle, status: sprintStatus },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: getErrorMessage(err, "Failed to create sprint"),
      },
      { status: 500 },
    );
  }
}
