"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface Suggestion {
  title: string;
  description: string;
  category: string;
  priority: "high" | "medium" | "low";
  scope: string[];
  effort: "small" | "medium" | "large";
}

interface SuggestState {
  suggestions: Suggestion[];
  selectedIndices: Set<number>;
  isLoading: boolean;
  error: string | null;

  fetchSuggestions: () => Promise<void>;
  toggleSelection: (idx: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  clear: () => void;
}

export const useSuggestStore = create<SuggestState>()(
  devtools(
    (set, get) => ({
      suggestions: [],
      selectedIndices: new Set(),
      isLoading: false,
      error: null,

      fetchSuggestions: async () => {
        set({ isLoading: true, error: null, suggestions: [], selectedIndices: new Set() }, false, "suggest/fetch/start");
        try {
          const res = await fetch("/api/tasks/suggest", { method: "POST" });
          const data = await res.json();
          if (data.error) {
            set({ error: data.error, isLoading: false }, false, "suggest/fetch/error");
          } else {
            set({ suggestions: data.suggestions ?? [], isLoading: false }, false, "suggest/fetch/done");
          }
        } catch {
          set({ error: "추천 요청 실패", isLoading: false }, false, "suggest/fetch/error");
        }
      },

      toggleSelection: (idx) => {
        set((state) => {
          const next = new Set(state.selectedIndices);
          if (next.has(idx)) next.delete(idx);
          else next.add(idx);
          return { selectedIndices: next };
        }, false, "suggest/toggle");
      },

      selectAll: () => {
        set((state) => ({
          selectedIndices: new Set(state.suggestions.map((_, i) => i)),
        }), false, "suggest/selectAll");
      },

      deselectAll: () => {
        set({ selectedIndices: new Set() }, false, "suggest/deselectAll");
      },

      clear: () => {
        set({ suggestions: [], selectedIndices: new Set(), error: null, isLoading: false }, false, "suggest/clear");
      },
    }),
    { name: "SuggestStore" },
  ),
);
