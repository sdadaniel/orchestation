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
  throw new Error("not implemented");
}

export async function onReviewFinished(
  taskId: string,
  result: JobReviewResult,
  ctx: TransitionContext,
): Promise<void> {
  throw new Error("not implemented");
}
