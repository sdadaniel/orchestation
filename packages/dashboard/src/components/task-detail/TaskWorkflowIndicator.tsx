"use client";

import { cn } from "@/lib/utils";
import type { TaskWorkflow } from "@/app/tasks/[id]/types";

function stepTypeLabel(type: string): string {
  switch (type) {
    case "task":
      return "작업";
    case "review":
      return "리뷰";
    case "check":
      return "체크";
    default:
      return type || "Step";
  }
}

function stepTone(status: string): "default" | "muted" {
  // UI 요구사항: 빨강/경고 톤 없이 “현재 단계”만 강조.
  // failed도 여기서는 중립으로 처리해서 리뷰가 과하게 튀지 않게 한다.
  if (status === "skipped") return "muted";
  return "default";
}

export function TaskWorkflowIndicator({
  workflow,
  taskStatus,
}: {
  workflow?: TaskWorkflow;
  taskStatus?: string;
}) {
  if (!workflow || !workflow.steps || workflow.steps.length === 0) return null;

  const normalizedTaskStatus = (taskStatus ?? "").toLowerCase();

  const isStepDone = (s: { status: string }) =>
    s.status === "done" || s.status === "skipped";

  const inferredCurrentKey = (() => {
    // If the task itself is done, the workflow is complete regardless of per-step bookkeeping.
    if (
      normalizedTaskStatus === "done" ||
      normalizedTaskStatus === "failed" ||
      normalizedTaskStatus === "rejected"
    ) {
      return "__completed__";
    }

    const inProgress = workflow.steps.find((s) => s.status === "in_progress");
    if (inProgress) return inProgress.key;

    const allDone = workflow.steps.every(isStepDone);
    if (allDone) return "__completed__";

    const allPending = workflow.steps.every((s) => s.status === "pending");
    if (allPending) return "__waiting__";

    const nextPending = workflow.steps.find((s) => s.status === "pending");
    return nextPending?.key ?? workflow.currentStepKey ?? "__waiting__";
  })();

  const displaySteps: Array<{
    key: string;
    label: string;
    status: "meta" | string;
  }> = [
    { key: "__waiting__", label: "대기", status: "meta" },
    ...workflow.steps.map((s) => ({
      key: s.key,
      label: stepTypeLabel(s.type),
      status: s.status,
    })),
    { key: "__completed__", label: "완료", status: "meta" },
  ];

  const currentIdx = Math.max(
    0,
    displaySteps.findIndex((s) => s.key === inferredCurrentKey),
  );

  // If task is stopped and no step is in_progress, keep indicator muted.
  const isMuted = normalizedTaskStatus === "stopped";

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-medium text-muted-foreground">Workflow</span>
      </div>

      <div className="flex items-center min-w-0">
        {displaySteps.map((step, idx) => {
          const isCurrent = idx === currentIdx;
          const isCompleted = idx < currentIdx;
          const isLast = idx === displaySteps.length - 1;
          const tone =
            step.status === "meta" ? "default" : stepTone(step.status);

          // Keep "current" visually strongest; completed steps should be subtle,
          // otherwise they can look like the active step (esp. when done).
          // IMPORTANT: keep Tailwind classes as literals (no template strings),
          // otherwise the JIT scanner may miss them and styles won't apply.
          const circleClass = isMuted
            ? "border-border bg-muted"
            : isCurrent
              ? "border-emerald-500 bg-emerald-500"
              : isCompleted
                ? "border-primary bg-muted"
                : "border-border bg-muted";

          const labelClass = isMuted
            ? "text-muted-foreground"
            : isCurrent
              ? "text-emerald-400"
              : isCompleted
                ? "text-muted-foreground"
                : "text-muted-foreground";

          const lineClass = isMuted
            ? "bg-border"
            : isCompleted
              ? "bg-primary/30"
              : "bg-border";

          return (
            <div key={step.key} className="flex items-center">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full border transition-colors",
                    circleClass,
                  )}
                />
                <span className={cn("text-[11px] whitespace-nowrap", labelClass)}>
                  {step.label}
                </span>
              </div>
              {!isLast && <span className={cn("mx-2 h-px w-6", lineClass)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
