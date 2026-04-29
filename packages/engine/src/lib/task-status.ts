import type { TaskStatus } from "../entities/task";

/** DB에 반영된 `TaskStatus` → 엔진 훅용 성공/실패. 비종료 상태는 undefined. */
export function taskStatusToResultOutcome(
  status: TaskStatus,
): "success" | "failure" | undefined {
  if (status === "done") return "success";
  if (status === "failed" || status === "rejected" || status === "stopped")
    return "failure";
  return undefined;
}
