import type { TaskStatus, TaskPriority } from "../../lib/constants";

export type WaterfallTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  role: string;
  depends_on: string[];
  blocks: string[];
  parallel_with: string[];
  affected_files: string[];
  sprint: string;
};

export type WaterfallGroup = {
  sprint: { id: string; title: string };
  tasks: WaterfallTask[];
  progress: { done: number; total: number };
};
