/**
 * signal-handler.ts
 *
 * 시그널 파일 처리 및 태스크 상태 전환 로직.
 * orchestrate-engine.ts에서 추출.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT, OUTPUT_DIR, SIGNALS_DIR } from "../lib/paths";
import { writeNotice } from "../parser/notice-parser";
import { parseCostLog } from "../parser/cost-parser";
import { getTask, updateTaskStatus, parseScope } from "../service/task-store";
import { runMergeTask } from "./merge-utils";
import { SKIP_REVIEW_ROLES } from "./runner/task-runner-utils";
import { scanTasks, taskRowToInfo, type TaskInfo } from "./scheduler";

export type SignalType =
  | "task-done"
  | "task-failed"
  | "task-rejected"
  | "review-approved"
  | "review-rejected"
  | "stopped";

const SIGNAL_TYPES: SignalType[] = [
  "task-done",
  "task-failed",
  "task-rejected",
  "review-approved",
  "review-rejected",
  "stopped",
];

const MAX_TASK_COST = 5.0;

export interface SignalHandlerCallbacks {
  log: (msg: string) => void;
  startTask: (taskId: string, feedbackFile?: string) => boolean;
  startReview: (taskId: string) => boolean;
  removeWorker: (taskId: string) => void;
  emitTaskResult: (taskId: string, status: "success" | "failure") => void;
  getRetryCount: (taskId: string) => number;
  bumpRetryCount: (taskId: string) => number;
  clearRetryCount: (taskId: string) => void;
  maxReviewRetry: () => number;
  baseBranch: () => string;
}

export function processSignals(cb: SignalHandlerCallbacks): void {
  if (!fs.existsSync(SIGNALS_DIR)) return;
  const files = fs.readdirSync(SIGNALS_DIR);

  for (const file of files) {
    for (const suffix of SIGNAL_TYPES) {
      const match = file.match(
        new RegExp(`^(TASK-\\d+)-${suffix.replace(/-/g, "\\-")}$`),
      );
      if (match) {
        const taskId = match[1];
        handleSignal(taskId, suffix, cb);
        try {
          fs.unlinkSync(path.join(SIGNALS_DIR, file));
        } catch {
          /* ignore */
        }
      }
    }
  }
}

export function handleSignal(
  taskId: string,
  signal: SignalType,
  cb: SignalHandlerCallbacks,
): void {
  cb.removeWorker(taskId);

  switch (signal) {
    case "stopped":
      cb.log(`  🛑 ${taskId} 중지됨`);
      setTaskStatus(taskId, "stopped", cb.log);
      break;

    case "task-done": {
      const info = readTaskInfo(taskId);
      const role = info?.role ?? "";
      if (SKIP_REVIEW_ROLES.includes(role)) {
        cb.log(`  ✅ ${taskId} task 완료 → review 스킵 → 머지`);
        mergeAndDone(taskId, cb);
      } else {
        cb.log(`  ✅ ${taskId} task 완료 → review 시작`);
        cb.startReview(taskId);
      }
      break;
    }

    case "task-rejected": {
      cb.log(`  🚫 ${taskId} 거절됨`);
      let reason = "";
      const reasonFile = path.join(
        OUTPUT_DIR,
        `${taskId}-rejection-reason.txt`,
      );
      if (fs.existsSync(reasonFile))
        reason = fs.readFileSync(reasonFile, "utf-8").split("\n")[0];
      markTaskRejected(taskId, reason, cb);
      break;
    }

    case "task-failed":
      cb.log(`  ❌ ${taskId} task 실행 실패`);
      markTaskFailed(taskId, "task 실행 실패", cb);
      break;

    case "review-approved":
      cb.log(`  ✅ ${taskId} review 승인 → 머지`);
      mergeAndDone(taskId, cb);
      break;

    case "review-rejected": {
      if (checkCostLimit(taskId, cb.log)) {
        markTaskFailed(taskId, "비용 상한 초과", cb);
        break;
      }
      const count = cb.getRetryCount(taskId);
      if (count < cb.maxReviewRetry()) {
        const next = cb.bumpRetryCount(taskId);
        cb.log(
          `  🔄 ${taskId} review 수정요청 → retry (${next}/${cb.maxReviewRetry()})`,
        );
        const feedbackFile = path.join(
          OUTPUT_DIR,
          `${taskId}-review-feedback.txt`,
        );
        cb.startTask(taskId, feedbackFile);
      } else {
        cb.log(`  ❌ ${taskId} retry 상한 초과 (${cb.maxReviewRetry()})`);
        markTaskFailed(taskId, "review retry 상한 초과", cb);
      }
      break;
    }
  }
}

export async function mergeAndDone(
  taskId: string,
  cb: SignalHandlerCallbacks,
): Promise<void> {
  const info = readTaskInfo(taskId);
  if (!info) return;

  const success = await runMergeTask(taskId, (line) => cb.log(`  ${line}`));

  if (success) {
    cb.clearRetryCount(taskId);
    writeNotice(
      "info",
      `${taskId} 완료`,
      `**${taskId}:** ${info.title}\n\n태스크가 성공적으로 완료되어 ${cb.baseBranch()}에 머지되었습니다.`,
    );
    cb.emitTaskResult(taskId, "success");
    cb.log(`  ✅ ${taskId} 완료 → ${cb.baseBranch()} 머지됨`);
  } else {
    markTaskFailed(taskId, "merge 실패", cb);
  }
}

export function markTaskFailed(
  taskId: string,
  reason: string,
  cb: SignalHandlerCallbacks,
): void {
  setTaskStatus(taskId, "failed", cb.log);
  cleanupWorktreeAndBranch(taskId, cb.log);
  cb.clearRetryCount(taskId);
  writeNotice("error", `${taskId} 실패`, `**${taskId}:** ${reason}`);
  stopDependents(taskId, cb.log);
  cb.emitTaskResult(taskId, "failure");
}

export function markTaskRejected(
  taskId: string,
  reason: string,
  cb: SignalHandlerCallbacks,
): void {
  setTaskStatus(taskId, "rejected", cb.log);
  cleanupWorktreeAndBranch(taskId, cb.log);
  cb.clearRetryCount(taskId);
  writeNotice("warning", `${taskId} 거절`, `**${taskId}:** ${reason}`);
}

function checkCostLimit(taskId: string, log: (msg: string) => void): boolean {
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

function cleanupWorktreeAndBranch(
  taskId: string,
  log: (msg: string) => void,
): void {
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
