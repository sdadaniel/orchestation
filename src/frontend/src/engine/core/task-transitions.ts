/**
 * task-transitions.ts
 *
 * 태스크 상태 전이를 단일 책임으로 모은 도메인 모듈.
 * 시그널 파일 경로를 대체한다 — 잡 완료 시점(runJobTask/runJobReview의 .then)에서
 * 엔진이 직접 호출한다.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT, OUTPUT_DIR } from "../../lib/paths";
import { writeNotice } from "../../parser/notice-parser";
import { parseCostLog } from "../../parser/cost-parser";
import { getTask, updateTaskStatus } from "../../service/task-store";
import { runMergeTask } from "../ops/merge-utils";
import { SKIP_REVIEW_ROLES } from "../runner/task-runner-utils";
import { scanTasks, taskRowToInfo, type TaskInfo } from "./scheduler";
import type { JobTaskResult } from "../jobs/job-task";
import type { JobReviewResult } from "../jobs/job-review";

export const MAX_TASK_COST = 5.0;

/** 엔진이 transitions에 넘기는 콜백/설정 묶음. */
export interface TransitionContext {
  log: (msg: string) => void;
  startTask: (taskId: string, feedbackFile?: string) => boolean;
  startReview: (taskId: string) => boolean;
  emitTaskResult: (taskId: string, status: "success" | "failure") => void;
  getRetryCount: (taskId: string) => number;
  bumpRetryCount: (taskId: string) => number;
  clearRetryCount: (taskId: string) => void;
  maxReviewRetry: () => number;
  baseBranch: () => string;
}

// 진입점 (Task 3, 4에서 구현)
export async function onTaskFinished(
  taskId: string,
  result: JobTaskResult,
  ctx: TransitionContext,
): Promise<void> {
  switch (result.status) {
    case "task-done": {
      const info = readTaskInfo(taskId);
      const role = info?.role ?? "";
      if (SKIP_REVIEW_ROLES.includes(role)) {
        ctx.log(`  ✅ ${taskId} task 완료 → review 스킵 → 머지`);
        await mergeAndDone(taskId, ctx);
      } else {
        ctx.log(`  ✅ ${taskId} task 완료 → review 시작`);
        ctx.startReview(taskId);
      }
      return;
    }

    case "task-rejected": {
      ctx.log(`  🚫 ${taskId} 거절됨`);
      let reason = "";
      const reasonFile = path.join(
        OUTPUT_DIR,
        `${taskId}-rejection-reason.txt`,
      );
      if (fs.existsSync(reasonFile))
        reason = fs.readFileSync(reasonFile, "utf-8").split("\n")[0];
      markTaskRejected(taskId, reason, ctx);
      return;
    }

    case "task-failed":
      ctx.log(`  ❌ ${taskId} task 실행 실패`);
      markTaskFailed(taskId, "task 실행 실패", ctx);
      return;
  }
}

export async function onReviewFinished(
  taskId: string,
  result: JobReviewResult,
  ctx: TransitionContext,
): Promise<void> {
  throw new Error("not implemented");
}

// ── 상태 전이 primitive ─────────────────────────────────

export async function mergeAndDone(
  taskId: string,
  ctx: TransitionContext,
): Promise<void> {
  const info = readTaskInfo(taskId);
  if (!info) return;

  const success = await runMergeTask(taskId, (line) => ctx.log(`  ${line}`));

  if (success) {
    ctx.clearRetryCount(taskId);
    writeNotice(
      "info",
      `${taskId} 완료`,
      `**${taskId}:** ${info.title}\n\n태스크가 성공적으로 완료되어 ${ctx.baseBranch()}에 머지되었습니다.`,
    );
    ctx.emitTaskResult(taskId, "success");
    ctx.log(`  ✅ ${taskId} 완료 → ${ctx.baseBranch()} 머지됨`);
  } else {
    markTaskFailed(taskId, "merge 실패", ctx);
  }
}

export function markTaskFailed(
  taskId: string,
  reason: string,
  ctx: TransitionContext,
): void {
  setTaskStatus(taskId, "failed", ctx.log);
  cleanupWorktreeAndBranch(taskId);
  ctx.clearRetryCount(taskId);
  writeNotice("error", `${taskId} 실패`, `**${taskId}:** ${reason}`);
  stopDependents(taskId, ctx.log);
  ctx.emitTaskResult(taskId, "failure");
}

export function markTaskRejected(
  taskId: string,
  reason: string,
  ctx: TransitionContext,
): void {
  setTaskStatus(taskId, "rejected", ctx.log);
  cleanupWorktreeAndBranch(taskId);
  ctx.clearRetryCount(taskId);
  writeNotice("warning", `${taskId} 거절`, `**${taskId}:** ${reason}`);
}

// ── pure helpers (테스트 대상) ─────────────────────────

/** 지금까지 누적 비용이 MAX_TASK_COST 초과면 true. 파일 I/O 있으나 순수에 가깝게 설계. */
export function isCostOverLimit(taskId: string, log: (msg: string) => void): boolean {
  try {
    const costData = parseCostLog();
    let total = 0;
    for (const entry of costData.entries) {
      if (entry.taskId === taskId) total += entry.costUsd;
    }
    if (total > MAX_TASK_COST) {
      log(
        `  🚨 ${taskId} 비용 상한 초과 ($${total.toFixed(2)} > $${MAX_TASK_COST})`,
      );
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** 현재 retry count가 max 미만이면 true. 테스트 용이한 순수 함수. */
export function canRetryReview(current: number, max: number): boolean {
  return current < max;
}

// ── 내부 헬퍼 ───────────────────────────────────────────

function setTaskStatus(
  taskId: string,
  newStatus: string,
  log: (msg: string) => void,
): void {
  const row = getTask(taskId);
  if (!row) {
    log(`  ⚠️  ${taskId}: DB에 없음`);
    return;
  }
  updateTaskStatus(
    taskId,
    newStatus as Parameters<typeof updateTaskStatus>[1],
    row.status,
  );
}

function readTaskInfo(taskId: string): TaskInfo | null {
  const row = getTask(taskId);
  if (!row) return null;
  return taskRowToInfo(row);
}

function cleanupWorktreeAndBranch(taskId: string): void {
  const info = readTaskInfo(taskId);
  if (!info) return;
  const worktreePath = info.worktree
    ? path.resolve(PROJECT_ROOT, info.worktree)
    : null;
  if (worktreePath && fs.existsSync(worktreePath)) {
    try {
      execSync(
        `git -C "${PROJECT_ROOT}" worktree remove "${worktreePath}" --force`,
        { stdio: "ignore" },
      );
    } catch {
      /* ignore */
    }
  }
  if (info.branch) {
    try {
      execSync(`git -C "${PROJECT_ROOT}" branch -D "${info.branch}"`, {
        stdio: "ignore",
      });
    } catch {
      /* ignore */
    }
  }
}

function stopDependents(failedId: string, log: (msg: string) => void): void {
  const allTasks = scanTasks();
  for (const task of allTasks) {
    if (task.status !== "pending") continue;
    if (task.dependsOn.includes(failedId)) {
      log(`  ⏸️  ${task.id}: 의존 태스크 ${failedId} 실패 → stopped`);
      setTaskStatus(task.id, "stopped", log);
      stopDependents(task.id, log);
    }
  }
}
