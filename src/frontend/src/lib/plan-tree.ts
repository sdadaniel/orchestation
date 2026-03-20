import type { PlanFrontmatter } from "@/lib/plan-parser";
import type { SprintData } from "@/lib/sprint-parser";
import type { TaskFrontmatter } from "@/lib/parser";
import type {
  PlanTreeData,
  PlanSprintNode,
  PlanTaskNode,
  PlanStatus,
} from "@/types/plan";

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
  sprints: SprintData[],
  tasks: TaskFrontmatter[],
): PlanTreeData {
  const sprintMap = new Map<string, SprintData>();
  for (const sprint of sprints) {
    sprintMap.set(sprint.id, sprint);
  }

  const taskMap = new Map<string, TaskFrontmatter>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  const sprintNodes: PlanSprintNode[] = plan.sprints.map((sprintId) => {
    const sprint = sprintMap.get(sprintId);

    if (!sprint) {
      return {
        id: sprintId,
        title: "(미정)",
        tasks: [],
        progress: { done: 0, total: 0 },
      };
    }

    const sprintTasks: PlanTaskNode[] = [];
    for (const taskId of sprint.tasks) {
      const task = taskMap.get(taskId);
      if (task) {
        sprintTasks.push(toPlanTaskNode(task));
      }
    }

    return {
      id: sprint.id,
      title: sprint.title,
      tasks: sprintTasks,
      progress: {
        done: sprintTasks.filter((t) => t.status === "done").length,
        total: sprintTasks.length,
      },
    };
  });

  return {
    plan: {
      id: plan.id,
      title: plan.title,
      status: VALID_PLAN_STATUSES.has(plan.status)
        ? (plan.status as PlanStatus)
        : "draft",
    },
    sprints: sprintNodes,
  };
}
