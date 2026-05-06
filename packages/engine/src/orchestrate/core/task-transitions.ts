/**
 * task-transitions.ts
 *
 * 태스크 상태 전이를 단일 책임으로 모은 도메인 모듈.
 * 시그널 파일 경로를 대체한다 — 잡 완료 시점(runJobTask/runJobReview의 .then)에서
 * 엔진이 직접 호출한다.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { PROJECT_ROOT, OUTPUT_DIR } from "../../lib/config/paths";
import { writeNotice } from "../../parser/notice-parser";
import { parseCostLog } from "../../parser/cost-parser";
import {
  getTask,
  getTaskStep,
  getTaskSteps,
  getNextPendingStep,
  resetTaskForRetry,
  recordStepEvent,
  updateTaskStep,
  updateTask,
  updateTaskStatus,
} from "../../service/task-store";
import { runMergeTask } from "../ops/merge-utils";
import {
  cleanupBranchAndWorktree,
  ensureBranchAndWorktree,
} from "../ops/worktree-utils";
import { SKIP_REVIEW_ROLES } from "../runner/task-runner-utils";
import { scanTasks, taskRowToInfo, type TaskInfo } from "./scheduler";
import type { JobTaskResult } from "../jobs/job-task";
import type { JobReviewResult } from "../jobs/job-review";
import type { StepType } from "../runner/step-runner";

export const MAX_TASK_COST = 5.0;

/** 엔진이 transitions에 넘기는 콜백/설정 묶음. */
export interface TransitionContext {
  log: (msg: string) => void;
  startStep: (
    taskId: string,
    stepId: string,
    opts?: { feedbackFile?: string },
  ) => boolean;
  emitTaskResult: (taskId: string) => void;
  maxReviewRetry: () => number;
  baseBranch: () => string;
}

export async function onStepFinished(
  taskId: string,
  stepId: string,
  stepType: StepType,
  result: JobTaskResult | JobReviewResult,
  ctx: TransitionContext,
): Promise<void> {
  // Mark step finished best-effort (status is refined by branching below)
  updateTaskStep(stepId, {
    status: "done",
    finished_at: new Date().toISOString(),
  });
  const resultStatus = (result as { status?: string }).status ?? "step-done";
  recordStepEvent(taskId, stepId, "step_end", resultStatus);

  if (stepType === "task") {
    await handleTaskStepFinished(taskId, stepId, result as JobTaskResult, ctx);
    return;
  }

  if (stepType === "review") {
    await handleReviewStepFinished(taskId, stepId, result as JobReviewResult, ctx);
    return;
  }

  // Unknown step types: treat as mpleted and continue
  await handleUnknownStepFinished(taskId, stepType, ctx);
}

// ── 상태 전이 primitive ─────────────────────────────────

export async function finalizeTask(
  taskId: string,
  ctx: TransitionContext,
): Promise<void> {
  const info = readTaskInfo(taskId);
  if (!info) return;

  const success = await runMergeTask(taskId, (line) => ctx.log(`  ${line}`));

  if (success) {
    // Merge success is the single source of truth for completion.
    // Persist done status so the dashboard can reflect completion via task.changed.
    setTaskStatus(taskId, "done", ctx.log);
    writeNotice(
      "info",
      `${taskId} 완료`,
      `**${taskId}:** ${info.title}\n\n태스크가 성공적으로 완료되어 ${ctx.baseBranch()}에 머지되었습니다.`,
    );
    ctx.emitTaskResult(taskId);
    ctx.log(`  ✅ ${taskId} 완료 → ${ctx.baseBranch()} 머지됨`);
  } else {
    markTaskFailed(taskId, "merge 실패", ctx);
  }
}

async function handleTaskStepFinished(
  taskId: string,
  stepId: string,
  result: JobTaskResult,
  ctx: TransitionContext,
): Promise<void> {
  switch (result.status) {
    case "task-done": {
      const info = readTaskInfo(taskId);
      const role = info?.role ?? "";

      // Find next step. If none → finalize, else dispatch.
      const next = getNextPendingStep(taskId);
      if (!next) {
        ctx.log(`  ✅ ${taskId} step(task) 완료 → 다음 step 없음 → 머지`);
        await finalizeTask(taskId, ctx);
        return;
      }

      // Keep legacy skip-review behavior when next is review
      if (next.step_type === "review" && SKIP_REVIEW_ROLES.includes(role)) {
        ctx.log(`  ✅ ${taskId} task 완료 → review 스킵 → 머지`);
        updateTaskStep(next.id, { status: "skipped" });
        await finalizeTask(taskId, ctx);
        return;
      }

      ctx.log(`  ✅ ${taskId} step(task) 완료 → 다음 step 시작: ${next.step_key}`);
      ctx.startStep(taskId, next.id);
      return;
    }

    case "task-rejected": {
      ctx.log(`  🚫 ${taskId} 거절됨`);
      const reason = readRejectionReasonFirstLine(taskId);
      markTaskRejected(taskId, reason, ctx);
      updateTaskStep(stepId, { status: "failed" });
      return;
    }

    case "task-failed":
      ctx.log(`  ❌ ${taskId} task 실행 실패`);
      markTaskFailed(taskId, "task 실행 실패", ctx);
      updateTaskStep(stepId, { status: "failed" });
      return;
  }
}

async function handleReviewStepFinished(
  taskId: string,
  stepId: string,
  result: JobReviewResult,
  ctx: TransitionContext,
): Promise<void> {
  if (result.status === "review-approved") {
    ctx.log(`  ✅ ${taskId} review 승인 → 머지`);
    await finalizeTask(taskId, ctx);
    return;
  }

  // review-rejected
  updateTaskStep(stepId, { status: "failed" });
  if (isCostOverLimit(taskId, ctx.log)) {
    markTaskFailed(taskId, "비용 상한 초과", ctx);
    return;
  }

  const reviewStep = getTaskStep(stepId);
  const attempts = (reviewStep?.attempt ?? 0) + 1;
  const max = reviewStep?.max_attempts ?? Math.max(1, ctx.maxReviewRetry());

  if (canRetryReview(attempts - 1, max)) {
    updateTaskStep(stepId, { attempt: attempts });
    ctx.log(`  🔄 ${taskId} review 수정요청 → retry (${attempts}/${max})`);

    // Retry by re-running the first task step (work)
    const steps = getTaskSteps(taskId);
    const work = steps.find((s) => s.step_type === "task") ?? null;
    if (!work) {
      markTaskFailed(taskId, "work step 없음 (retry 불가)", ctx);
      return;
    }

    updateTaskStep(work.id, {
      status: "pending",
      finished_at: null,
      started_at: null,
    });

    const feedbackFile = path.join(OUTPUT_DIR, `${taskId}-review-feedback.txt`);
    ctx.startStep(taskId, work.id, { feedbackFile });
  } else {
    ctx.log(`  ❌ ${taskId} retry 상한 초과 (${attempts}/${max})`);
    markTaskFailed(taskId, "review retry 상한 초과", ctx);
  }
}

async function handleUnknownStepFinished(
  taskId: string,
  stepType: StepType,
  ctx: TransitionContext,
): Promise<void> {
  const next = getNextPendingStep(taskId);
  if (!next) {
    ctx.log(`  ✅ ${taskId} step(${stepType}) 완료 → 다음 step 없음 → 머지`);
    await finalizeTask(taskId, ctx);
    return;
  }
  ctx.log(`  ✅ ${taskId} step(${stepType}) 완료 → 다음 step 시작: ${next.step_key}`);
  ctx.startStep(taskId, next.id);
}

function readRejectionReasonFirstLine(taskId: string): string {
  const reasonFile = path.join(OUTPUT_DIR, `${taskId}-rejection-reason.txt`);
  if (!fs.existsSync(reasonFile)) return "";
  try {
    return fs.readFileSync(reasonFile, "utf-8").split("\n")[0] ?? "";
  } catch {
    return "";
  }
}

export function markTaskFailed(
  taskId: string,
  reason: string,
  ctx: TransitionContext,
): void {
  setTaskStatus(taskId, "failed", ctx.log);
  cleanupWorktreeAndBranch(taskId);
  writeNotice("error", `${taskId} 실패`, `**${taskId}:** ${reason}`);
  stopDependents(taskId, ctx.log);
  ctx.emitTaskResult(taskId);
}

export function markTaskRejected(
  taskId: string,
  reason: string,
  ctx: TransitionContext,
): void {
  setTaskStatus(taskId, "rejected", ctx.log);
  cleanupWorktreeAndBranch(taskId);
  writeNotice("warning", `${taskId} 거절`, `**${taskId}:** ${reason}`);
}

export function retryTask(taskId: string, ctx: TransitionContext): {
  reactivatedDependentIds: string[];
  resetStepCount: number;
} {
  const row = getTask(taskId);
  if (!row) {
    throw new Error("Task not found");
  }

  const branch = row.branch || `task/${taskId.toLowerCase()}`;
  const shouldReuseWorkspace =
    row.status !== "failed" &&
    !!row.branch &&
    !!row.worktree &&
    fs.existsSync(path.resolve(PROJECT_ROOT, row.worktree));
  const worktree = shouldReuseWorkspace
    ? row.worktree!
    : buildRetryWorktreePath(taskId);

  if (!shouldReuseWorkspace) {
    if (row.branch && row.worktree) {
      cleanupBranchAndWorktree(row.branch, row.worktree, ctx.log);
    }
    ensureBranchAndWorktree(branch, worktree, ctx.baseBranch(), ctx.log);
  }

  cleanupRetryArtifacts(taskId);
  updateTask(taskId, { branch, worktree });

  const reset = resetTaskForRetry(taskId);
  if (!reset) {
    throw new Error("Task retry reset failed");
  }

  ctx.log(
    `  🔄 ${taskId} retry 준비 완료 (steps=${reset.resetStepIds.length}, dependents=${reset.reactivatedDependentIds.length})`,
  );

  return {
    reactivatedDependentIds: reset.reactivatedDependentIds,
    resetStepCount: reset.resetStepIds.length,
  };
}

// ── pure helpers (테스트 대상) ─────────────────────────

/** 지금까지 누적 비용이 MAX_TASK_COST 초과면 true. 파일 I/O 있으나 순수에 가깝게 설계. */
export function isCostOverLimit(
  taskId: string,
  log: (msg: string) => void,
): boolean {
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
  if (!info.branch || !info.worktree) return;
  cleanupBranchAndWorktree(info.branch, info.worktree);
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

function cleanupRetryArtifacts(taskId: string): void {
  const artifactNames = [
    `${taskId}-task.json`,
    `${taskId}-review.json`,
    `${taskId}-rejection-reason.txt`,
    `${taskId}-review-feedback.txt`,
  ];

  for (const fileName of artifactNames) {
    try {
      fs.unlinkSync(path.join(OUTPUT_DIR, fileName));
    } catch {
      /* ignore */
    }
  }
}

function buildRetryWorktreePath(taskId: string): string {
  return path.join(os.tmpdir(), "orchestation-worktrees", taskId.toLowerCase());
}
