import { NextResponse } from "next/server";
import {
  readFullTree,
  readManifest,
  writeManifest,
  findNodeById,
  insertNode,
  generateId,
  writeDocContent,
  type DocNode,
} from "@/lib/doc-tree";

export const dynamic = "force-dynamic";

/** GET /api/docs — return the full docs tree (all directories) */
export async function GET() {
  const fullTree = readFullTree();
  return NextResponse.json(fullTree);
}

/** POST /api/docs — create a new doc or folder */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, type, parentId } = body as {
      title: string;
      type: "doc" | "folder";
      parentId?: string | null;
    };

    if (!title || !type) {
      return NextResponse.json({ error: "title and type are required" }, { status: 400 });
    }

    const manifest = readManifest();
    const id = generateId(type === "folder" ? "folder" : "doc");

    const node: DocNode = {
      id,
      title,
      type,
      children: [],
    };

    if (type === "doc") {
      const fileName = `${id}.md`;
      node.file = fileName;
      writeDocContent(fileName, "", title);
    }

    const pid = parentId || null;
    const inserted = insertNode(manifest.tree, pid, node);
    if (!inserted && pid) {
      return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
    }

    writeManifest(manifest);
    return NextResponse.json({ ok: true, node }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}
