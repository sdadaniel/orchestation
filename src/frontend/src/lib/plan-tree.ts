import type { PlanFrontmatter } from "@/lib/plan-parser";
import type { TaskFrontmatter } from "@/lib/parser";
import type { PlanTreeData, PlanTaskNode, PlanStatus } from "@/types/plan";

const VALID_PLAN_STATUSES: Set<string> = new Set([
  "draft",
  "in_progress",
  "done",
]);

function toPlanTaskNode(task: TaskFrontmatter): PlanTaskNode {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
  };
}

export function buildPlanTree(
  plan: PlanFrontmatter,
  tasks: TaskFrontmatter[],
): PlanTreeData {
  return {
    plan: {
      id: plan.id,
      title: plan.title,
      status: VALID_PLAN_STATUSES.has(plan.status)
        ? (plan.status as PlanStatus)
        : "draft",
    },
    tasks: tasks.map((t) => toPlanTaskNode(t)),
  };
}
