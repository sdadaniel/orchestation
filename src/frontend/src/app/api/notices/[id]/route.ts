import { NextResponse } from "next/server";
import fs from "fs";
import { findNoticeFile, parseNoticeFile } from "@/parser/notice-parser";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const filePath = findNoticeFile(id);
  if (!filePath) {
    return NextResponse.json({ error: "Notice not found" }, { status: 404 });
  }

  const notice = parseNoticeFile(filePath);
  if (!notice) {
    return NextResponse.json({ error: "Failed to parse notice" }, { status: 500 });
  }

  return NextResponse.json(notice);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const filePath = findNoticeFile(id);
  if (!filePath) {
    return NextResponse.json({ error: "Notice not found" }, { status: 404 });
  }

  const body = await req.json();
  const raw = fs.readFileSync(filePath, "utf-8");

  let updated = raw;

  if (body.read !== undefined) {
    updated = updated.replace(/^read:\s*.+$/m, `read: ${body.read}`);
  }
  if (body.title) {
    updated = updated.replace(/^title:\s*.+$/m, `title: ${body.title}`);
  }
  if (body.type) {
    updated = updated.replace(/^type:\s*.+$/m, `type: ${body.type}`);
  }
  if (body.content !== undefined) {
    updated = updated.replace(/(^---\n[\s\S]*?\n---\n?)[\s\S]*/, `$1${body.content}\n`);
  }

  // Update timestamp
  const now = new Date().toISOString().split("T")[0];
  updated = updated.replace(/^updated:\s*.+$/m, `updated: ${now}`);

  fs.writeFileSync(filePath, updated, "utf-8");

  const notice = parseNoticeFile(filePath);
  return NextResponse.json(notice);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const filePath = findNoticeFile(id);
  if (!filePath) {
    return NextResponse.json({ error: "Notice not found" }, { status: 404 });
  }

  fs.unlinkSync(filePath);
  return NextResponse.json({ ok: true });
}
