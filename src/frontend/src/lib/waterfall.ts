import type { WaterfallGroup, WaterfallTask } from "@/types/waterfall";
import type { TaskFrontmatter } from "@/lib/parser";
import type { TaskStatus } from "../../lib/constants";

const VALID_STATUSES: Set<TaskStatus> = new Set([
  "pending",
  "stopped",
  "in_progress",
  "reviewing",
  "done",
  "failed",
  "rejected",
]);

function toWaterfallTask(task: TaskFrontmatter): WaterfallTask {
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
  };
}

export function buildWaterfallGroups(
  tasks: TaskFrontmatter[],
): WaterfallGroup[] {
  const waterfallTasks = tasks.map((t) => toWaterfallTask(t));
  return [
    {
      tasks: waterfallTasks,
      progress: {
        done: waterfallTasks.filter((t) => t.status === "done").length,
        total: waterfallTasks.length,
      },
    },
  ];
}
