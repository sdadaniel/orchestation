"use client";

import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import type { AnalyzedTask } from "@/app/tasks/new/types";
import type { TaskPriority } from "@/entities/task";
import type { NewTaskIntakeTab, Phase } from "@/views/tasks/new/types";

export interface Suggestion {
  title: string;
  description: string;
  category: string;
  priority: TaskPriority;
  scope: string[];
  effort: "small" | "medium" | "large";
}

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const draftDefaults = {
  intakeTab: "create" as NewTaskIntakeTab,
  funnelStep: "draft" as Phase,
  title: "",
  description: "",
  tasks: [] as AnalyzedTask[],
  editingIdx: null as number | null,
  revisionNotes: "",
  inputExternalDeps: [] as string[],
  analyzeError: null as string | null,
  suggestions: [] as Suggestion[],
  selectedSuggestionIndices: [] as number[],
  suggestError: null as string | null,
};

const transientDefaults = {
  suggestLoading: false,
  analyzing: false,
  revising: false,
  confirming: false,
  creatingSuggestions: false,
};

export type NewTaskPageDraftState = typeof draftDefaults &
  typeof transientDefaults & {
    setIntakeTab: (tab: NewTaskIntakeTab) => void;
    setFunnelStep: (step: Phase) => void;
    setTitle: (v: string) => void;
    setDescription: (v: string) => void;
    setTasks: (tasks: AnalyzedTask[] | ((prev: AnalyzedTask[]) => AnalyzedTask[])) => void;
    setEditingIdx: (idx: number | null) => void;
    setRevisionNotes: (v: string) => void;
    setInputExternalDeps: (ids: string[]) => void;
    setAnalyzeError: (v: string | null) => void;
    setAnalyzing: (v: boolean) => void;
    setRevising: (v: boolean) => void;
    setConfirming: (v: boolean) => void;
    setCreatingSuggestions: (v: boolean) => void;
    fetchSuggestions: () => Promise<void>;
    toggleSuggestionSelection: (index: number) => void;
    selectAllSuggestions: () => void;
    deselectAllSuggestions: () => void;
    clearSuggestions: () => void;
    setSuggestError: (v: string | null) => void;
    resetDraft: () => void;
  };

export const useNewTaskPageDraftStore = create<NewTaskPageDraftState>()(
  devtools(
    persist(
      (set) => ({
        ...draftDefaults,
        ...transientDefaults,

        setIntakeTab: (intakeTab) => set({ intakeTab }, false, "newTaskDraft/setIntakeTab"),
        setFunnelStep: (funnelStep) => set({ funnelStep }, false, "newTaskDraft/setFunnelStep"),
        setTitle: (title) => set({ title }, false, "newTaskDraft/setTitle"),
        setDescription: (description) => set({ description }, false, "newTaskDraft/setDescription"),
        setTasks: (updater) =>
          set(
            (s) => ({
              tasks: typeof updater === "function" ? updater(s.tasks) : updater,
            }),
            false,
            "newTaskDraft/setTasks",
          ),
        setEditingIdx: (editingIdx) => set({ editingIdx }, false, "newTaskDraft/setEditingIdx"),
        setRevisionNotes: (revisionNotes) =>
          set({ revisionNotes }, false, "newTaskDraft/setRevisionNotes"),
        setInputExternalDeps: (inputExternalDeps) =>
          set({ inputExternalDeps }, false, "newTaskDraft/setInputExternalDeps"),
        setAnalyzeError: (analyzeError) =>
          set({ analyzeError }, false, "newTaskDraft/setAnalyzeError"),
        setAnalyzing: (analyzing) => set({ analyzing }, false, "newTaskDraft/setAnalyzing"),
        setRevising: (revising) => set({ revising }, false, "newTaskDraft/setRevising"),
        setConfirming: (confirming) => set({ confirming }, false, "newTaskDraft/setConfirming"),
        setCreatingSuggestions: (creatingSuggestions) =>
          set({ creatingSuggestions }, false, "newTaskDraft/setCreatingSuggestions"),

        fetchSuggestions: async () => {
          set(
            {
              suggestLoading: true,
              suggestError: null,
              suggestions: [],
              selectedSuggestionIndices: [],
            },
            false,
            "newTaskDraft/suggest/fetch/start",
          );
          try {
            const res = await fetch("/api/tasks/suggest", { method: "POST" });
            const data = await res.json();
            if (data.error) {
              set(
                { suggestError: data.error, suggestLoading: false },
                false,
                "newTaskDraft/suggest/fetch/error",
              );
            } else {
              set(
                { suggestions: data.suggestions ?? [], suggestLoading: false },
                false,
                "newTaskDraft/suggest/fetch/done",
              );
            }
          } catch {
            set(
              { suggestError: "추천 요청 실패", suggestLoading: false },
              false,
              "newTaskDraft/suggest/fetch/error",
            );
          }
        },

        toggleSuggestionSelection: (index) =>
          set(
            (s) => {
              const next = new Set(s.selectedSuggestionIndices);
              if (next.has(index)) next.delete(index);
              else next.add(index);
              return { selectedSuggestionIndices: [...next] };
            },
            false,
            "newTaskDraft/suggest/toggle",
          ),

        selectAllSuggestions: () =>
          set(
            (s) => ({
              selectedSuggestionIndices: s.suggestions.map((_, i) => i),
            }),
            false,
            "newTaskDraft/suggest/selectAll",
          ),

        deselectAllSuggestions: () =>
          set({ selectedSuggestionIndices: [] }, false, "newTaskDraft/suggest/deselectAll"),

        clearSuggestions: () =>
          set(
            {
              suggestions: [],
              selectedSuggestionIndices: [],
              suggestError: null,
              suggestLoading: false,
            },
            false,
            "newTaskDraft/suggest/clear",
          ),

        setSuggestError: (suggestError) =>
          set({ suggestError }, false, "newTaskDraft/setSuggestError"),

        resetDraft: () =>
          set(
            {
              ...draftDefaults,
              ...transientDefaults,
            },
            false,
            "newTaskDraft/reset",
          ),
      }),
      {
        name: "dashboard:new-task-page-draft",
        storage: createJSONStorage(() =>
          typeof window !== "undefined" ? window.localStorage : noopStorage,
        ),
        skipHydration: true,
        partialize: (s) => ({
          intakeTab: s.intakeTab,
          funnelStep: s.funnelStep,
          title: s.title,
          description: s.description,
          tasks: s.tasks,
          editingIdx: s.editingIdx,
          revisionNotes: s.revisionNotes,
          inputExternalDeps: s.inputExternalDeps,
          analyzeError: s.analyzeError,
          suggestions: s.suggestions,
          selectedSuggestionIndices: s.selectedSuggestionIndices,
          suggestError: s.suggestError,
        }),
        version: 1,
      },
    ),
    { name: "NewTaskPageDraftStore" },
  ),
);

export function selectedSuggestionIndicesToSet(indices: number[]): Set<number> {
  return new Set(indices);
}
