import { NextRequest, NextResponse } from "next/server";
import { parseAllRequests, findRequestFile } from "@/lib/request-parser";
import fs from "fs";

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

  const all = parseAllRequests();
  const target = all.find((r) => r.id === id);
  if (!target) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // 같은 status 내에서 sort_order 기준 정렬
  const siblings = all
    .filter((r) => r.status === target.status)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));

  const idx = siblings.findIndex((r) => r.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Task not in group" }, { status: 400 });
  }

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) {
    return NextResponse.json({ ok: true }); // already at boundary
  }

  const other = siblings[swapIdx];

  // Swap sort_order values; if both are 0, assign sequential values first
  let targetOrder = target.sort_order;
  let otherOrder = other.sort_order;
  if (targetOrder === otherOrder) {
    // Assign sequential orders to all siblings
    for (let i = 0; i < siblings.length; i++) {
      siblings[i].sort_order = i;
      writeSortOrder(siblings[i].id, i);
    }
    targetOrder = siblings[idx].sort_order;
    otherOrder = siblings[swapIdx].sort_order;
  }

  // Swap
  writeSortOrder(target.id, otherOrder);
  writeSortOrder(other.id, targetOrder);

  return NextResponse.json({ ok: true });
}

function writeSortOrder(taskId: string, order: number) {
  const filePath = findRequestFile(taskId);
  if (!filePath) return;

  let content = fs.readFileSync(filePath, "utf-8");

  if (/^sort_order:\s*.+$/m.test(content)) {
    content = content.replace(/^sort_order:\s*.+$/m, `sort_order: ${order}`);
  } else {
    // Add sort_order after priority line in frontmatter
    content = content.replace(/^(priority:\s*.+)$/m, `$1\nsort_order: ${order}`);
  }

  fs.writeFileSync(filePath, content, "utf-8");
}
