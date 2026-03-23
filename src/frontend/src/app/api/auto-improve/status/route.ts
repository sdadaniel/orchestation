import { NextResponse } from "next/server";
import autoImproveManager from "@/lib/auto-improve-manager";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = autoImproveManager.getState();

  return NextResponse.json({
    status: state.status,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    exitCode: state.exitCode,
  });
}
