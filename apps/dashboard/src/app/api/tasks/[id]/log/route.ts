import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const taskId = id.replace(/^REQ-/, "TASK-");

  const logPath = path.join(PROJECT_ROOT, "output", "logs", `${taskId}.log`);

  if (!fs.existsSync(logPath)) {
    return new NextResponse("", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  try {
    const content = fs.readFileSync(logPath, "utf-8");
    return new NextResponse(content, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch {
    return new NextResponse("", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
