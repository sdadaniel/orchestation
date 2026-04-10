import { NextResponse } from "next/server";
import orchestrationManager from "@/lib/orchestration-manager";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!orchestrationManager.isRunning()) {
    return NextResponse.json(
      { error: "No orchestration is currently running" },
      { status: 409 },
    );
  }

  const result = orchestrationManager.stop();

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    message: "Stop signal sent",
    status: orchestrationManager.getStatus(),
  });
}
