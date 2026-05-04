"use client";

import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

export interface WizardCreatedRequest {
  id: string;
  title: string;
}

type BatchOutcome = "idle" | "success" | "error";

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

interface NewTaskCreationState {
  /** Successfully persisted requests during the latest wizard batch */
  createdItems: WizardCreatedRequest[];
  inProgress: boolean;
  lastOutcome: BatchOutcome;
  lastError: string | null;
  lastFinishedAt: number | null;

  startBatch: () => void;
  recordCreated: (item: WizardCreatedRequest) => void;
  completeBatchSuccess: () => void;
  completeBatchError: (message: string) => void;
  clearRecovery: () => void;
}

export const useNewTaskCreationStore = create<NewTaskCreationState>()(
  devtools(
    persist(
      (set) => ({
        createdItems: [],
        inProgress: false,
        lastOutcome: "idle",
        lastError: null,
        lastFinishedAt: null,

        startBatch: () =>
          set(
            {
              createdItems: [],
              inProgress: true,
              lastOutcome: "idle",
              lastError: null,
              lastFinishedAt: null,
            },
            false,
            "newTaskCreation/startBatch",
          ),

        recordCreated: (item) =>
          set(
            (s) => ({
              createdItems: [...s.createdItems, item],
            }),
            false,
            "newTaskCreation/recordCreated",
          ),

        completeBatchSuccess: () =>
          set(
            {
              inProgress: false,
              lastOutcome: "success",
              lastError: null,
              lastFinishedAt: Date.now(),
            },
            false,
            "newTaskCreation/completeSuccess",
          ),

        completeBatchError: (message) =>
          set(
            {
              inProgress: false,
              lastOutcome: "error",
              lastError: message,
              lastFinishedAt: Date.now(),
            },
            false,
            "newTaskCreation/completeError",
          ),

        clearRecovery: () =>
          set(
            {
              createdItems: [],
              lastOutcome: "idle",
              lastError: null,
              lastFinishedAt: null,
            },
            false,
            "newTaskCreation/clearRecovery",
          ),
      }),
      {
        name: "dashboard:new-task-creation-recovery",
        storage: createJSONStorage(() =>
          typeof window !== "undefined" ? window.localStorage : noopStorage,
        ),
        skipHydration: true,
        partialize: (s) => ({
          createdItems: s.createdItems,
          lastOutcome: s.lastOutcome,
          lastError: s.lastError,
          lastFinishedAt: s.lastFinishedAt,
        }),
        merge: (persisted, current) => ({
          ...current,
          ...(persisted && typeof persisted === "object" ? persisted : {}),
          inProgress: false,
        }),
        version: 1,
      },
    ),
    { name: "NewTaskCreationStore" },
  ),
);
