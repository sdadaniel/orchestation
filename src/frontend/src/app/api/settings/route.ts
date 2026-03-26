import { NextRequest, NextResponse } from "next/server";
import { loadSettings, saveSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function maskKey(key: string): string {
  if (!key || key.length < 10) return key ? "****" : "";
  return key.slice(0, 7) + "..." + key.slice(-4);
}

export async function GET() {
  const settings = loadSettings();
  return NextResponse.json({
    ...settings,
    apiKey: maskKey(settings.apiKey),
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = saveSettings(body);
    return NextResponse.json({
      ...updated,
      apiKey: maskKey(updated.apiKey),
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
