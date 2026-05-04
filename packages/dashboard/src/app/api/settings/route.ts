import { NextRequest, NextResponse } from "next/server";
import { loadSettings, saveSettings } from "@/lib/config/settings";
import { callGatewayRpc } from "@/lib/gateway-rpc-server";

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

    let engineConfigReload: { reloaded: boolean; reason?: string } | null = null;
    try {
      engineConfigReload = await callGatewayRpc<{
        reloaded: boolean;
        reason?: string;
      }>(req, "orchestrate.reloadConfig", {});
    } catch {
      engineConfigReload = null;
    }

    return NextResponse.json({
      ...updated,
      apiKey: maskKey(updated.apiKey),
      engineConfigReload,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
