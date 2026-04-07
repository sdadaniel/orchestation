"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { OrchestrationStatus, OrchestrationStatusData } from "@/engine/orchestration-manager";

export type { OrchestrationStatus, OrchestrationStatusData };

interface OrchestrationState {
  data: OrchestrationStatusData;
  justFinished: boolean;
  isRunning: boolean;
  clearFinished: () => void;
}

const DEFAULT_DATA: OrchestrationStatusData = {
  status: "idle",
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  taskResults: [],
};

export const useOrchestrationStore = create<OrchestrationState>()(
  devtools(
    (set) => ({
      data: DEFAULT_DATA,
      justFinished: false,
      isRunning: false,
      clearFinished: () =>
        set({ justFinished: false }, false, "orchestration/clearFinished"),
    }),
    { name: "OrchestrationStore" },
  ),
);

// 상태 업데이트는 SseProvider가 SSE 이벤트로 처리 — 클라이언트 폴링 제거됨
