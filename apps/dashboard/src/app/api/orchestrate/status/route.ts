import { NextResponse } from "next/server";
import { execSync } from "child_process";
import orchestrationManager from "@/engine/orchestration-manager";

export const dynamic = "force-dynamic";

/** CLI/터미널에서 직접 실행된 orchestrate engine 감지 */
function isOrchestrateRunningExternally(): boolean {
  try {
    const result = execSync(
      'pgrep -f "run-engine\\.ts" 2>/dev/null | head -1',
      {
        encoding: "utf-8",
        timeout: 2000,
      },
    ).trim();
    return result.length > 0;
  } catch {
    return false;
  }
}

export async function GET() {
  const state = orchestrationManager.getState();

  // Manager가 idle이지만 외부에서 orchestrate engine이 실행 중이면 running으로 표시
  if (state.status === "idle" && isOrchestrateRunningExternally()) {
    return NextResponse.json({
      status: "running",
      startedAt: null,
      finishedAt: null,
      exitCode: null,
      taskResults: [],
      external: true,
    });
  }

  return NextResponse.json({
    status: state.status,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    exitCode: state.exitCode,
    taskResults: state.taskResults,
  });
}
