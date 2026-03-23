import { NextResponse } from "next/server";
import fs from "fs";
import { findRequestFile, parseRequestFile, getRequestsDir } from "@/lib/request-parser";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const filePath = findRequestFile(id);

  if (!filePath) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const existing = fs.readFileSync(filePath, "utf-8");

    const fmMatch = existing.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      return NextResponse.json({ error: "Invalid file format" }, { status: 500 });
    }

    let fm = fmMatch[1];
    const oldContent = existing.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();

    // Update frontmatter fields if provided
    if (body.status && ["pending", "in_progress", "done"].includes(body.status)) {
      fm = fm.replace(/^status:\s*.+$/m, `status: ${body.status}`);
    }
    if (body.title && typeof body.title === "string") {
      fm = fm.replace(/^title:\s*.+$/m, `title: ${body.title.trim()}`);
    }
    if (body.priority && ["high", "medium", "low"].includes(body.priority)) {
      fm = fm.replace(/^priority:\s*.+$/m, `priority: ${body.priority}`);
    }

    const newContent = body.content !== undefined ? body.content.trim() : oldContent;
    const fileContent = `---\n${fm}\n---\n${newContent}\n`;

    // If title changed, rename file
    if (body.title && typeof body.title === "string") {
      const slug = body.title.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/-+$/, "");
      const newPath = `${getRequestsDir()}/${id}-${slug}.md`;
      fs.writeFileSync(newPath, fileContent, "utf-8");
      if (newPath !== filePath) {
        fs.unlinkSync(filePath);
      }
    } else {
      fs.writeFileSync(filePath, fileContent, "utf-8");
    }

    // Return updated data
    const updated = body.title
      ? parseRequestFile(`${getRequestsDir()}/${id}-${body.title.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/-+$/, "")}.md`)
      : parseRequestFile(filePath);

    return NextResponse.json(updated || { ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const filePath = findRequestFile(id);

  if (!filePath) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  try {
    fs.unlinkSync(filePath);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete" },
      { status: 500 },
    );
  }
}
