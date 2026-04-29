import type { WaterfallTask } from "@/types/waterfall";

export type TaskBarProps = {
  task: WaterfallTask;
  onClick?: (task: WaterfallTask) => void;
};

export type TaskDetailPanelProps = {
  task: WaterfallTask | null;
  onClose: () => void;
};
