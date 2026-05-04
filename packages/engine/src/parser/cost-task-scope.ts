/**
 * token-usage.log 행이 오케스트레이션 태스크(TASK-*)에 속하는지.
 * Node `fs` 없음 — Next 클라이언트 컴포넌트에서도 import 가능.
 */
export function isOrchestrationTaskCostEntry(entry: {
  taskId: string;
}): boolean {
  return /^TASK-/i.test(entry.taskId);
}
