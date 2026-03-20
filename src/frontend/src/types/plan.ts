export type PlanStatus = "draft" | "in_progress" | "done";

export type PlanTaskNode = {
  id: string;
  title: string;
  status: string;
  priority: string;
};

export type PlanSprintNode = {
  id: string;
  title: string;
  tasks: PlanTaskNode[];
  progress: { done: number; total: number };
};

export type PlanTreeData = {
  plan: {
    id: string;
    title: string;
    status: PlanStatus;
  };
  sprints: PlanSprintNode[];
};
