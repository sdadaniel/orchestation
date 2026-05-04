import type { UseFunnelReturn } from "@/hooks/useFunnel";
import type { AnalyzedTask } from "@/app/tasks/new/types";
import type { Suggestion } from "@/store/newTaskPageDraftStore";
import type { TaskOption } from "../components/types";
import type { NewTaskIntakeTab, Phase } from "../types";

type CreateFunnelContext = Record<string, never>;
export type NewTaskCreateFunnel = UseFunnelReturn<
  Phase,
  CreateFunnelContext
>;

export type NewTaskCreationRecoveryGet =
  | {
      items: { id: string; title: string }[];
      variant: "success" | "error";
      message: string | null;
      onDismiss: () => void;
    }
  | null;

/** Read-only slice (re-renders when this data changes). */
export type NewTaskPageGetValue = {
  intakeTab: NewTaskIntakeTab;
  phase: Phase;
  createFunnel: NewTaskCreateFunnel;
  title: string;
  description: string;
  analyzing: boolean;
  analyzeError: string | null;
  tasks: AnalyzedTask[];
  editingIdx: number | null;
  confirming: boolean;
  creatingSuggestions: boolean;
  existingTasks: TaskOption[];
  inputExternalDeps: string[];
  availableRoles: string[];
  suggestions: Suggestion[];
  suggestLoading: boolean;
  suggestError: string | null;
  selectedSuggestions: Set<number>;
  canConfirm: boolean;
  /** 리뷰 단계: 추가 자연어 요청으로 AI 재생성 */
  revisionNotes: string;
  revising: boolean;
  creationRecovery: NewTaskCreationRecoveryGet;
};

/** Stable actions (prefer `useNewTaskPageSet` only when you need no read re-renders). */
export type NewTaskPageSetValue = {
  setIntakeTab: (tab: NewTaskIntakeTab) => void;
  setPhase: (phase: Phase) => void;
  setTitle: (v: string) => void;
  setDescription: (v: string) => void;
  setInputExternalDeps: (ids: string[]) => void;
  setEditingIdx: (idx: number | null) => void;
  handleSuggest: () => void;
  toggleSuggestion: (index: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  createFromSuggestions: () => Promise<void>;
  handleAnalyze: () => Promise<void>;
  /** 현재 미리보기 tasks + revisionNotes로 analyze API refine 분기 호출 */
  handleRefineTasks: () => Promise<void>;
  /** 진행 중인 AI 태스크 수정 요청 중단 (fetch abort + 서버 프로세스 종료) */
  cancelRefineTasks: () => void;
  setRevisionNotes: (v: string) => void;
  handleConfirm: () => Promise<void>;
  updateTask: (idx: number, updates: Partial<AnalyzedTask>) => void;
  removeTask: (idx: number) => void;
  addTask: () => void;
  goToTasks: () => void;
};
