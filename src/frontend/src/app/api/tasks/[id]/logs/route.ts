import { NextResponse } from "next/server";
import {
  isValidTaskId,
  taskExists,
  hasLogSources,
  getTaskLogs,
} from "@/lib/task-log-parser";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Validate task ID format
    if (!isValidTaskId(id)) {
      return NextResponse.json(
        { error: "Invalid task ID format" },
        { status: 400 },
      );
    }

    // Check task exists
    if (!taskExists(id)) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 },
      );
    }

    // Check if any log sources exist
    if (!hasLogSources(id)) {
      return NextResponse.json(
        { error: "No logs found for this task" },
        { status: 404 },
      );
    }

    const logs = getTaskLogs(id);

    return NextResponse.json(logs);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to retrieve logs",
      },
      { status: 500 },
    );
  }
}
