import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "@/lib/config/paths";
import { getTaskLookupKeys, resolveTaskRef } from "@/service/task-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const taskKeys = getTaskLookupKeys(resolveTaskRef(id)?.task ?? id);

  const logPath = taskKeys
    .map((taskKey) => path.join(PROJECT_ROOT, "output", "logs", `${taskKey}.log`))
    .find((filePath) => fs.existsSync(filePath));

  if (!logPath) {
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
