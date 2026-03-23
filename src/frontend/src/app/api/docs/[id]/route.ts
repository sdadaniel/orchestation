import { NextResponse } from "next/server";
import {
  readManifest,
  writeManifest,
  findNodeById,
  removeNodeById,
  readDocContent,
  writeDocContent,
  deleteDocFile,
  collectFiles,
  findParentPath,
} from "@/lib/doc-tree";

export const dynamic = "force-dynamic";

/** GET /api/docs/[id] — get a single doc with content and breadcrumb */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const manifest = readManifest();
  const node = findNodeById(manifest.tree, id);

  if (!node) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const parentPath = findParentPath(manifest.tree, id) || [];
  const content = node.file ? readDocContent(node.file) : "";

  return NextResponse.json({
    id: node.id,
    title: node.title,
    type: node.type,
    file: node.file,
    content,
    parentPath,
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
  const manifest = readManifest();
  const node = findNodeById(manifest.tree, id);

  if (!node) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Delete all associated files
  const files = collectFiles(node);
  for (const file of files) {
    deleteDocFile(file);
  }

  removeNodeById(manifest.tree, id);
  writeManifest(manifest);

  return NextResponse.json({ ok: true });
}
