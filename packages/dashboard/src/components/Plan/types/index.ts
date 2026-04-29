import type { PlanTreeData } from "@/types/plan";

export type PlanTreeContainerProps = {
  data: PlanTreeData;
  onTaskClick: (taskId: string) => void;
};
