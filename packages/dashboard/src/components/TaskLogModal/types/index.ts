import type { WaterfallTask } from "@/types/waterfall";

export interface TaskLogModalProps {
  task: WaterfallTask;
  onClose: () => void;
}
