import { NextResponse } from "next/server";
import orchestrationManager from "@/lib/orchestration-manager";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = orchestrationManager.getState();

  return NextResponse.json({
    status: state.status,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    exitCode: state.exitCode,
    taskResults: state.taskResults,
  });
}
