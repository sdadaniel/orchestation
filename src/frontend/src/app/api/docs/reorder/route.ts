import { NextResponse } from "next/server";
import {
  readManifest,
  writeManifest,
  findNodeById,
  removeNodeById,
  insertNode,
} from "@/lib/doc-tree";

export const dynamic = "force-dynamic";

/** PUT /api/docs/reorder — move a node to a new parent/position */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, parentId, index } = body as {
      id: string;
      parentId: string | null;
      index?: number;
    };

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const manifest = readManifest();
    const node = findNodeById(manifest.tree, id);

    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    // Clone node before removal
    const cloned = JSON.parse(JSON.stringify(node));

    removeNodeById(manifest.tree, id);
    const inserted = insertNode(manifest.tree, parentId ?? null, cloned, index);

    if (!inserted) {
      // Rollback: re-insert at root
      manifest.tree.push(cloned);
      writeManifest(manifest);
      return NextResponse.json(
        { error: "Target parent not found" },
        { status: 404 },
      );
    }

    writeManifest(manifest);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}
