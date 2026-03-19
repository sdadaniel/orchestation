import type {
  WaterfallGroup,
  WaterfallTask,
  WaterfallTaskStatus,
} from "@/types/waterfall";
import type { TaskFrontmatter } from "@/lib/parser";

export type SprintResponse = {
  id: string;
  title: string;
  tasks: string[];
};

const VALID_STATUSES: Set<string> = new Set([
  "backlog",
  "in_progress",
  "in_review",
  "done",
]);

const UNASSIGNED_SPRINT = { id: "unassigned", title: "미배정" };

function toWaterfallTask(task: TaskFrontmatter): WaterfallTask {
  return {
    id: task.id,
    title: task.title,
    status: VALID_STATUSES.has(task.status)
      ? (task.status as WaterfallTaskStatus)
      : "backlog",
    priority: task.priority,
    role: task.role,
    depends_on: task.depends_on,
    blocks: task.blocks,
    parallel_with: task.parallel_with,
  };
}

function computeProgress(tasks: WaterfallTask[]): {
  done: number;
  total: number;
} {
  return {
    done: tasks.filter((t) => t.status === "done").length,
    total: tasks.length,
  };
}

export function buildWaterfallGroups(
  tasks: TaskFrontmatter[],
  sprints: SprintResponse[],
): WaterfallGroup[] {
  const taskMap = new Map<string, TaskFrontmatter>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  const assignedTaskIds = new Set<string>();
  const groups: WaterfallGroup[] = [];

  for (const sprint of sprints) {
    const sprintTasks: WaterfallTask[] = [];

    for (const taskId of sprint.tasks) {
      const task = taskMap.get(taskId);
      if (task) {
        sprintTasks.push(toWaterfallTask(task));
        assignedTaskIds.add(taskId);
      }
    }

    groups.push({
      sprint: { id: sprint.id, title: sprint.title },
      tasks: sprintTasks,
      progress: computeProgress(sprintTasks),
    });
  }

  const unassignedTasks: WaterfallTask[] = [];
  for (const task of tasks) {
    if (!assignedTaskIds.has(task.id)) {
      unassignedTasks.push(toWaterfallTask(task));
    }
  }

  if (unassignedTasks.length > 0) {
    groups.push({
      sprint: UNASSIGNED_SPRINT,
      tasks: unassignedTasks,
      progress: computeProgress(unassignedTasks),
    });
  }

  return groups;
}
