import type { TaskPriority, TaskStatus } from "@/entities/task";

export type WaterfallTask = {
  id: string;
  display_id?: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  role: string;
  depends_on: string[];
  blocks: string[];
  parallel_with: string[];
  scope: string[];
};

export type WaterfallGroup = {
  tasks: WaterfallTask[];
  progress: { done: number; total: number };
};
