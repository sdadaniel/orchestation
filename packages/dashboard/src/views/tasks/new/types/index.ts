import type { AnalyzedTask } from "@/app/tasks/new/types";
import type { TaskOption } from "../components/types";

export type Phase = "draft" | "review";

export type NewTaskPreviewSectionProps = {
  title: string;
  description: string;
  tasks: AnalyzedTask[];
  editingIdx: number | null;
  analyzeError: string | null;
  confirming: boolean;
  canConfirm: boolean;
  existingTasks: TaskOption[];
  availableRoles: string[];
  onReturnToDraft: () => void;
  onGoToTasks: () => void;
  onEditToggle: (idx: number) => void;
  onTaskUpdate: (idx: number, updates: Partial<AnalyzedTask>) => void;
  onTaskRemove: (idx: number) => void;
  onAddTask: () => void;
  onConfirm: () => void;
};

export type { TaskOption };
