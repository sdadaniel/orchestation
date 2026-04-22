import type { TaskStatus, TaskPriority } from "@/constants/status";

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
};

export type WaterfallGroup = {
  tasks: WaterfallTask[];
  progress: { done: number; total: number };
};
