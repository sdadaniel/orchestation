import type {
  WaterfallGroup,
  WaterfallTask,
} from "@/types/waterfall";
import type { TaskFrontmatter } from "@/lib/parser";
import type { TaskStatus } from "../../lib/constants";

export type SprintResponse = {
  id: string;
  title: string;
  tasks: string[];
};

const VALID_STATUSES: Set<TaskStatus> = new Set([
  "pending",
  "stopped",
  "in_progress",
  "reviewing",
  "done",
  "rejected",
]);

const UNASSIGNED_SPRINT = { id: "unassigned", title: "미배정" };

function toWaterfallTask(
  task: TaskFrontmatter,
  sprintTitle: string,
): WaterfallTask {
  return {
    id: task.id,
    title: task.title,
    status: VALID_STATUSES.has(task.status) ? task.status : "pending",
    priority: task.priority,
    role: task.role,
    depends_on: task.depends_on,
    blocks: task.blocks,
    parallel_with: task.parallel_with,
    affected_files: task.affected_files,
    sprint: sprintTitle,
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
        sprintTasks.push(toWaterfallTask(task, sprint.title));
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
      unassignedTasks.push(toWaterfallTask(task, UNASSIGNED_SPRINT.title));
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
