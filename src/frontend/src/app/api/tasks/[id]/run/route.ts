import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import taskRunnerManager from "@/engine/runner/task-runner-manager";
import orchestrationManager from "@/engine/orchestration-manager";
import { getTask, getAllTasks, updateTaskStatus, parseDependsOn } from "@/service/task-store";
import { PROJECT_ROOT, OUTPUT_DIR } from "@/lib/paths";

const SIGNAL_DIR = path.join(PROJECT_ROOT, ".orchestration", "signals");
const TASK_ID_PATTERN = /^TASK-\d{3}$/;

function isValidTaskId(id: string): boolean {
  return TASK_ID_PATTERN.test(id);
}

/** task DB의 status를 stopped로 업데이트 */
function markTaskAsStopped(taskId: string): void {
  const task = getTask(taskId);
  if (!task) return;
  updateTaskStatus(taskId, "stopped", task.status as string);
}

/** stop-request 시그널 파일 생성 (워커가 killed-by-user 인지 구분) */
function createStopRequest(taskId: string): void {
  try {
    fs.mkdirSync(SIGNAL_DIR, { recursive: true });
    const target = path.join(SIGNAL_DIR, `${taskId}-stop-request`);
    const tmp = `${target}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, String(process.pid));
    fs.renameSync(tmp, target);
  } catch {
    // best-effort
  }
}

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
  const taskRow = getTask(id);
  if (taskRow) {
    const dependsOnIds = parseDependsOn(taskRow);
    if (dependsOnIds.length > 0) {
      const allTasks = getAllTasks();
      const unmetDeps = dependsOnIds.filter(depId => {
        const dep = allTasks.find(t => t.id === depId);
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

  // 이전 실행 결과 파일 삭제 (재실행 시 이전 결과가 표시되는 것 방지)
  const prevResultPath = path.join(OUTPUT_DIR, `${id}-task.json`);
  const prevConvPath = path.join(OUTPUT_DIR, `${id}-task-conversation.jsonl`);
  const prevRejectionPath = path.join(OUTPUT_DIR, `${id}-rejection-reason.txt`);
  for (const p of [prevResultPath, prevConvPath, prevRejectionPath]) {
    try { fs.unlinkSync(p); } catch { /* not exists */ }
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

  if (!id || typeof id !== "string" || !isValidTaskId(id)) {
    return NextResponse.json({ error: "Invalid task ID format" }, { status: 400 });
  }

  // stop-request 시그널 파일 생성
  createStopRequest(id);

  // 1) TaskRunnerManager로 관리되는 프로세스 중지 시도
  const result = taskRunnerManager.stop(id);

  // 2) TaskRunnerManager에 없으면 (orchestrate engine으로 실행된 경우)
  //    claude 워커 프로세스를 직접 찾아서 kill
  if (!result.success) {
    try {
      const pids = execSync(
        `pgrep -f "claude.*${id}" 2>/dev/null || true`,
        { encoding: "utf-8" },
      ).trim();

      if (!pids) {
        // 프로세스가 없어도 DB 상태는 stopped로 업데이트
        markTaskAsStopped(id);
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
    } catch {
      // kill 실패해도 DB 상태는 stopped로 업데이트
      markTaskAsStopped(id);
      return NextResponse.json(
        { error: `${id} 중지 실패` },
        { status: 500 },
      );
    }
  }

  // 프로세스 종료 후 task DB 상태 → stopped
  markTaskAsStopped(id);

  return NextResponse.json({ message: `Task ${id} stopped`, status: "stopped" });
}
