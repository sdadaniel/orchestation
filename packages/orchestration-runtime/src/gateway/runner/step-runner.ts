import type { JobReviewResult } from "../jobs/job-review";
import type { JobTaskResult } from "../jobs/job-task";
import { runJobReview } from "../jobs/job-review";
import { runJobTask } from "../jobs/job-task";

export const STEP_TYPES = ["task", "review", "check"] as const;
export type StepType = (typeof STEP_TYPES)[number];

export type StepRunResult =
  | { stepType: "task"; status: JobTaskResult["status"]; raw: JobTaskResult }
  | { stepType: "review"; status: JobReviewResult["status"]; raw: JobReviewResult }
  | { stepType: "check"; status: "step-done"; raw: { status: "step-done" } };

export async function runStep(args: {
  stepType: StepType;
  taskId: string;
  stepId?: string;
  feedbackFile?: string;
  log: (line: string) => void;
}): Promise<StepRunResult> {
  const { stepType, taskId, stepId, feedbackFile, log } = args;

  if (stepType === "review") {
    const raw = await runJobReview(taskId, log, stepId);
    return { stepType: "review", status: raw.status, raw };
  }

  if (stepType === "task") {
    const raw = await runJobTask(taskId, feedbackFile, log, stepId);
    return { stepType: "task", status: raw.status, raw };
  }

  // check = no-op successful step (reserved for lightweight validators)
  return { stepType: "check", status: "step-done", raw: { status: "step-done" } };
}
