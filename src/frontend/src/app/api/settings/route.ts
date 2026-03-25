import { NextRequest, NextResponse } from "next/server";
import { loadSettings, saveSettings, maskApiKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = loadSettings();
  return NextResponse.json({
    ...settings,
    claudeApiKey: maskApiKey(settings.claudeApiKey),
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = saveSettings(body);
    return NextResponse.json({
      ...updated,
      claudeApiKey: maskApiKey(updated.claudeApiKey),
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
