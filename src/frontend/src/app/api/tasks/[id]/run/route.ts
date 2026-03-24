import { NextRequest, NextResponse } from "next/server";
import taskRunnerManager from "@/lib/task-runner-manager";
import orchestrationManager from "@/lib/orchestration-manager";

export const dynamic = "force-dynamic";

/** POST - start running a single task */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Block if orchestration is running
  if (orchestrationManager.isRunning()) {
    return NextResponse.json(
      { error: "파이프라인 실행 중입니다. 중지 후 다시 시도하세요." },
      { status: 409 }
    );
  }

  const result = taskRunnerManager.run(id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({
    message: `Task ${id} started`,
    taskId: id,
  });
}

/** GET - get run status for a single task */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = taskRunnerManager.getState(id);

  if (!state) {
    return NextResponse.json({
      status: "idle",
      taskId: id,
      logs: [],
    });
  }

  return NextResponse.json(state);
}

/** DELETE - stop a running task */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = taskRunnerManager.stop(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ message: `Task ${id} stop requested` });
}
