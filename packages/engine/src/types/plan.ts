import type { TaskPriority, TaskStatus } from "@/entities/task";

export type PlanStatus = "draft" | "in_progress" | "done";

export type PlanTaskNode = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
};

export type PlanTreeData = {
  plan: {
    id: string;ㄴ
    title: string;
    status: PlanStatus;
  };
  tasks: PlanTaskNode[];
};
