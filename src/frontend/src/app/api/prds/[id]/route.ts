import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const PRD_DIR = path.join(process.cwd(), "../../docs/prd");

function findPrdFile(id: string): string | null {
  if (!fs.existsSync(PRD_DIR)) return null;
  const files = fs.readdirSync(PRD_DIR);
  const file = files.find((f) => f.startsWith(id) && f.endsWith(".md"));
  return file ? path.join(PRD_DIR, file) : null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const filePath = findPrdFile(id);

  if (!filePath) {
    return NextResponse.json({ error: "PRD not found" }, { status: 404 });
  }

  const { content } = await request.json();

  if (typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  try {
    // 기존 파일 읽어서 frontmatter 보존
    const existing = fs.readFileSync(filePath, "utf-8");
    const fmMatch = existing.match(/^(---\n[\s\S]*?\n---)\n?/);
    const frontmatter = fmMatch ? fmMatch[1] : "";

    const newContent = frontmatter ? `${frontmatter}\n\n${content}` : content;
    fs.writeFileSync(filePath, newContent, "utf-8");

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
