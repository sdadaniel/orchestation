import { NextResponse } from "next/server";
import { parseDependsOn, parseScope } from "@/lib/task-row-parsers";
import { getAllTasks, getTaskDisplayId } from "@/service/task-store";
import type { TaskGraphItem } from "@/types/task-graph";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = getAllTasks();
  const tasks: TaskGraphItem[] = rows.map((row) => ({
    id: row.id,
    display_id: getTaskDisplayId(row),
    title: row.title,
    status: row.status as TaskGraphItem["status"],
    phase: row.phase ?? null,
    priority: row.priority as TaskGraphItem["priority"],
    depends_on: parseDependsOn(row),
    blocks: [],
    parallel_with: [],
    role: row.role ?? "",
    scope: parseScope(row),
    content: row.content ?? "",
    created: row.created ?? "",
    updated: row.updated ?? "",
    sort_order: row.sort_order ?? 0,
    branch: row.branch ?? "",
  }));

  return NextResponse.json(tasks);
}
