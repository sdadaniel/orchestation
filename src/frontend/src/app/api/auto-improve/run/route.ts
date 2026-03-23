import { NextResponse } from "next/server";
import autoImproveManager from "@/lib/auto-improve-manager";

export const dynamic = "force-dynamic";

export async function POST() {
  if (autoImproveManager.isRunning()) {
    return NextResponse.json(
      { error: "Auto-improve is already running" },
      { status: 409 }
    );
  }

  const result = autoImproveManager.run();

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Auto-improve started",
    status: autoImproveManager.getStatus(),
    startedAt: autoImproveManager.getState().startedAt,
  });
}
