import type { JobReviewResult } from "../jobs/job-review";
import type { JobTaskResult } from "../jobs/job-task";
import { runJobReview } from "../jobs/job-review";
import { runJobTask } from "../jobs/job-task";

export type StepType = string;

export type StepRunResult =
  | { stepType: "task"; status: JobTaskResult["status"]; raw: JobTaskResult }
  | {
      stepType: "review";
      status: JobReviewResult["status"];
      raw: JobReviewResult;
    }
  | { stepType: string; status: "step-done"; raw: { status: "step-done" } };

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

  // Unknown step types are treated as no-op successful steps for now.
  return { stepType, status: "step-done", raw: { status: "step-done" } };
}
