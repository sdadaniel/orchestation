import type { TaskStatus, TaskPriority } from "../../lib/constants";

export type PlanStatus = "draft" | "in_progress" | "done";

export type PlanTaskNode = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
};

export type PlanTreeData = {
  plan: {
    id: string;
    title: string;
    status: PlanStatus;
  };
  tasks: PlanTaskNode[];
};
