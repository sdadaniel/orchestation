import { NextResponse } from "next/server";
import {
  readFullTree,
  readManifest,
  writeManifest,
  findNodeById,
  removeNodeById,
  readDocContent,
  writeDocContent,
  deleteDocFile,
  collectFiles,
  findParentPath,
} from "@/parser/doc-tree";

export const dynamic = "force-dynamic";

/** GET /api/docs/[id] — get a single doc with content and breadcrumb */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Search in the full tree (all docs directories)
  const fullTree = readFullTree();
  const node = findNodeById(fullTree.tree, id);

  if (!node) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const parentPath = findParentPath(fullTree.tree, id) || [];
  const content = node.file ? readDocContent(node.file) : "";

  return NextResponse.json({
    id: node.id,
    title: node.title,
    type: node.type,
    file: node.file,
    content,
    parentPath,
    readonly: node.readonly ?? false,
  });
}

/** PUT /api/docs/[id] — update title, content, or parentId */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const manifest = readManifest();
  const node = findNodeById(manifest.tree, id);

  if (!node) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const body = await request.json();
  const { title, content } = body as { title?: string; content?: string };

  if (title !== undefined) {
    node.title = title;
  }

  if (content !== undefined && node.file) {
    writeDocContent(node.file, content, title ?? node.title);
  }

  writeManifest(manifest);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/docs/[id] — delete a doc or folder (and all children files) */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Search in full tree (includes all dirs like todo/, not just prd/)
  const fullTree = readFullTree();
  const node = findNodeById(fullTree.tree, id);

  if (!node) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Delete all associated files
  const files = collectFiles(node);
  for (const file of files) {
    deleteDocFile(file);
  }

  // Also remove from prd manifest if present
  const manifest = readManifest();
  if (findNodeById(manifest.tree, id)) {
    removeNodeById(manifest.tree, id);
    writeManifest(manifest);
  }

  return NextResponse.json({ ok: true });
}
