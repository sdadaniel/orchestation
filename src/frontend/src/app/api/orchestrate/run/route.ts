import { NextResponse } from "next/server";
import orchestrationManager from "@/lib/orchestration-manager";

export const dynamic = "force-dynamic";

export async function POST() {
  if (orchestrationManager.isRunning()) {
    return NextResponse.json(
      { error: "Orchestration is already running" },
      { status: 409 }
    );
  }

  const result = orchestrationManager.run();

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Orchestration started",
    status: orchestrationManager.getStatus(),
    startedAt: orchestrationManager.getState().startedAt,
  });
}
