import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  readFullTree,
  readManifest,
  writeManifest,
  insertNode,
  findNodeById,
  generateId,
  writeDocContent,
  type DocNode,
} from "@/parser/doc-tree";

export const dynamic = "force-dynamic";

const DOCS_DIR = path.join(process.cwd(), "../../docs");

/** parentId로부터 docs/ 기준 디렉토리 경로를 추출 (예: "dir-architecture" → "architecture") */
function resolveParentDir(parentId: string | null): string | null {
  if (!parentId) return null;
  // "dir-xxx" → "xxx", "dir-architecture-legacy" → "architecture/legacy"
  if (parentId.startsWith("dir-")) {
    return parentId.slice(4).replace(/-/g, "/");
  }
  return null;
}

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

    const id = generateId(type === "folder" ? "folder" : "doc");

    // parentId가 prd 내부 ID이면 prd manifest에 추가
    const manifest = readManifest();
    const isPrdParent = !parentId || parentId === "dir-prd" || !!findNodeById(manifest.tree, parentId);

    if (isPrdParent) {
      // 기존 로직: prd manifest에 추가
      const node: DocNode = { id, title, type, children: [] };
      if (type === "doc") {
        const fileName = `${id}.md`;
        node.file = fileName;
        writeDocContent(fileName, "", title);
      }
      const pid = parentId === "dir-prd" ? null : (parentId || null);
      const inserted = insertNode(manifest.tree, pid, node);
      if (!inserted && pid) {
        return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
      }
      writeManifest(manifest);
      return NextResponse.json({ ok: true, node }, { status: 201 });
    }

    // 다른 docs 폴더 (architecture, report 등)에 직접 생성
    const dirRel = resolveParentDir(parentId!);
    if (!dirRel) {
      return NextResponse.json({ error: "Invalid parentId" }, { status: 400 });
    }

    const targetDir = path.join(DOCS_DIR, dirRel);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // fullTree 호환 ID 생성: "file-{dirRel}-{id}" (dir-xxx 형식)
    const treeId = type === "doc"
      ? `file-${dirRel.replace(/\//g, "-")}-${id.replace(".md", "")}`
      : `dir-${dirRel.replace(/\//g, "-")}-${id}`;
    const node: DocNode = { id: treeId, title, type, children: [] };

    if (type === "doc") {
      const fileName = `${dirRel}/${id}.md`;
      node.file = fileName;
      const filePath = path.join(DOCS_DIR, fileName);
      fs.writeFileSync(filePath, `# ${title}\n`, "utf-8");
    } else {
      // 폴더 생성
      fs.mkdirSync(path.join(targetDir, id), { recursive: true });
    }

    return NextResponse.json({ ok: true, node }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}
