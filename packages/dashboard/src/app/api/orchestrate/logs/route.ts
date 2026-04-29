import { NextResponse } from "next/server";
import orchestrationManager from "@/orchestrate/orchestration-manager";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 200;
  const logs = orchestrationManager.getRecentLogs(limit);
  return NextResponse.json({ logs, total: logs.length });
}
