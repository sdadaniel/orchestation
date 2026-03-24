import { NextRequest, NextResponse } from "next/server";
import { loadSettings, saveSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = loadSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = saveSettings(body);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
