import { NextRequest, NextResponse } from "next/server";
import nightWorkerManager from "@/lib/night-worker";

export const dynamic = "force-dynamic";

/** GET — 상태 + 로그 반환 */
export async function GET() {
  const state = nightWorkerManager.getState();
  return NextResponse.json(state);
}

/** POST — Night Worker 시작 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { until, budget, maxTasks, types, instructions } = body;

  const result = nightWorkerManager.run({
    until,
    budget: budget || null,
    maxTasks,
    types: types || undefined,
    instructions,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const state = nightWorkerManager.getState();
  return NextResponse.json({
    message: "Night Worker 시작됨",
    pid: state.pid,
    until: state.until,
    budget: state.budget ?? "unlimited",
    maxTasks: state.maxTasks,
    types: state.types,
  });
}

/** DELETE — Night Worker 중지 */
export async function DELETE() {
  const result = nightWorkerManager.stop();

  if (!result.success) {
    return NextResponse.json({ error: "실행 중인 Night Worker가 없습니다." }, { status: 409 });
  }

  return NextResponse.json({ message: "Night Worker 중지됨" });
}
