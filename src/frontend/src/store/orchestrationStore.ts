"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { OrchestrationStatus, OrchestrationStatusData } from "@/lib/orchestration-manager";

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

/* ── Singleton polling (client-side only) ── */

const POLL_INTERVAL_IDLE = 5000;
const POLL_INTERVAL_RUNNING = 2000;

let prevStatus: OrchestrationStatus = "idle";
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let isPolling = false;

async function poll() {
  try {
    const res = await fetch("/api/orchestrate/status");
    if (res.ok) {
      const json: OrchestrationStatusData = await res.json();
      const justFinished =
        prevStatus === "running" &&
        (json.status === "completed" || json.status === "failed");

      prevStatus = json.status;

      const current = useOrchestrationStore.getState();
      useOrchestrationStore.setState(
        {
          data: json,
          isRunning: json.status === "running",
          // keep justFinished=true until clearFinished is called
          justFinished: justFinished ? true : current.justFinished,
        },
        false,
        "orchestration/update",
      );
    }
  } catch {
    // silently ignore network errors
  }

  const interval =
    prevStatus === "running" ? POLL_INTERVAL_RUNNING : POLL_INTERVAL_IDLE;
  pollTimer = setTimeout(poll, interval);
}

export function startOrchestrationPolling() {
  if (isPolling || typeof window === "undefined") return;
  isPolling = true;
  poll();
}

export function stopOrchestrationPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  isPolling = false;
}

// Auto-start in browser environment
if (typeof window !== "undefined") {
  startOrchestrationPolling();
}
