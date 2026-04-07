import { NextResponse } from "next/server";
import autoImproveManager from "@/engine/auto-improve-manager";

export const dynamic = "force-dynamic";

export async function POST() {
  if (autoImproveManager.getStatus() !== "running") {
    return NextResponse.json(
      { error: "Auto-improve is not running" },
      { status: 409 }
    );
  }

  const result = autoImproveManager.stop();

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Graceful stop signal sent",
    status: autoImproveManager.getStatus(),
  });
}
