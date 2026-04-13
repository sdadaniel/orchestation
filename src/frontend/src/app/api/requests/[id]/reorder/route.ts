import { NextRequest, NextResponse } from "next/server";
import { getAllTasks, updateTask } from "@/service/task-store";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { direction } = await req.json();

  if (direction !== "up" && direction !== "down") {
    return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
  }

  const allTasks = getAllTasks();
  const target = allTasks.find((t) => t.id === id);
  if (!target) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const siblings = allTasks
    .filter((t) => t.status === target.status)
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id),
    );

  const idx = siblings.findIndex((t) => t.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Task not in group" }, { status: 400 });
  }

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) {
    return NextResponse.json({ ok: true });
  }

  const other = siblings[swapIdx];
  let targetOrder = target.sort_order ?? 0;
  let otherOrder = other.sort_order ?? 0;

  if (targetOrder === otherOrder) {
    for (let i = 0; i < siblings.length; i++) {
      updateTask(siblings[i].id, { sort_order: i });
    }
    targetOrder = idx;
    otherOrder = swapIdx;
  }

  updateTask(id, { sort_order: otherOrder });
  updateTask(other.id, { sort_order: targetOrder });

  return NextResponse.json({ ok: true });
}
