import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import taskRunnerManager from "@/lib/task-runner-manager";
import orchestrationManager from "@/lib/orchestration-manager";
import { parseAllRequests, findRequestFile, parseRequestFile } from "@/lib/request-parser";

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

  // 의존성 체크: depends_on의 모든 task가 done이어야 실행 가능
  const taskFile = findRequestFile(id);
  if (taskFile) {
    const taskData = parseRequestFile(taskFile);
    if (taskData && taskData.depends_on.length > 0) {
      const allTasks = parseAllRequests();
      const unmetDeps = taskData.depends_on.filter((depId) => {
        const dep = allTasks.find((t) => t.id === depId);
        return !dep || dep.status !== "done";
      });
      if (unmetDeps.length > 0) {
        return NextResponse.json(
          { error: `의존성 미충족: ${unmetDeps.join(", ")}이(가) 아직 완료되지 않았습니다.` },
          { status: 409 },
        );
      }
    }
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

  // 1) TaskRunnerManager로 관리되는 프로세스 중지 시도
  const result = taskRunnerManager.stop(id);

  // 2) TaskRunnerManager에 없으면 (orchestrate.sh로 실행된 경우)
  //    run-worker.sh 프로세스를 직접 찾아서 kill
  if (!result.success) {
    try {
      const pids = execSync(
        `pgrep -f "run-worker\\.sh ${id}" 2>/dev/null || true`,
        { encoding: "utf-8" },
      ).trim();

      if (!pids) {
        return NextResponse.json(
          { error: `${id}에 대한 실행 중인 프로세스를 찾을 수 없습니다.` },
          { status: 409 },
        );
      }

      // 프로세스 그룹 전체 kill (claude CLI 포함)
      for (const pid of pids.split("\n")) {
        const trimmedPid = pid.trim();
        if (trimmedPid) {
          try {
            // 프로세스 그룹 kill (-pid)
            process.kill(-parseInt(trimmedPid, 10), "SIGTERM");
          } catch {
            // 프로세스 그룹 kill 실패 시 개별 kill
            try {
              process.kill(parseInt(trimmedPid, 10), "SIGTERM");
            } catch { /* already dead */ }
          }
        }
      }

      return NextResponse.json({ message: `Task ${id} stop requested (via process kill)` });
    } catch {
      return NextResponse.json(
        { error: `${id} 중지 실패` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ message: `Task ${id} stop requested` });
}
