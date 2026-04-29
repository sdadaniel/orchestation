"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { LogLine } from "@/components/Logs/type";
import { MAX_LOG_LINES } from "@/components/Logs/const";

interface LogsState {
  lines: LogLine[];
  status: string;
  connected: boolean;

  clear: () => void;
  setStatus: (status: string) => void;
  markConnected: () => void;
  applyIncoming: (payload: { logs?: string[]; total?: number }) => void;
}

const knownIds = new Set<number>();
let lastTotal: number | null = null;
let maxSeenId = -1;

export const useLogsStore = create<LogsState>()(
  devtools(
    (set, get) => ({
      lines: [],
      status: "idle",
      connected: false,

      clear: () => {
        knownIds.clear();
        lastTotal = null;
        maxSeenId = -1;
        set({ lines: [] }, false, "logs/clear");
      },

      setStatus: (status) => set({ status }, false, "logs/setStatus"),

      markConnected: () => {
        if (get().connected) return;
        set({ connected: true }, false, "logs/markConnected");
      },

      applyIncoming: (payload) => {
        const newLogs = Array.isArray(payload.logs) ? payload.logs : [];
        const total = typeof payload.total === "number" ? payload.total : null;

        if (total !== null) {
          if (lastTotal !== null && total < lastTotal) {
            // dev/HMR 등으로 total이 뒤로 가는 비정상 케이스: dedupe 상태를 리셋한다.
            knownIds.clear();
            maxSeenId = -1;
            set({ lines: [] }, false, "logs/totalBackwardsReset");
          }
          lastTotal = total;
        }

        if (newLogs.length === 0) return;

        set(
          (state) => {
            const receivedAtIso = new Date().toISOString();
            const startId =
              total !== null ? Math.max(0, total - newLogs.length) : -1;

            const nextEntries: LogLine[] = newLogs.map((line, i) => {
              const id = startId >= 0 ? startId + i : Date.now() + i;
              return { id, receivedAtIso, line };
            });

            if (state.lines.length === 0) {
              knownIds.clear();
              for (const e of nextEntries) knownIds.add(e.id);
              maxSeenId = Math.max(maxSeenId, nextEntries[nextEntries.length - 1]!.id);
              return { lines: nextEntries.slice().reverse() };
            }

            const maxIncomingId = nextEntries[nextEntries.length - 1]!.id;
            const newOnes = nextEntries.filter((e) => e.id > maxSeenId);
            if (newOnes.length > 0) {
              maxSeenId = Math.max(maxSeenId, maxIncomingId);
              const merged = [...newOnes.slice().reverse(), ...state.lines];
              const clipped =
                merged.length > MAX_LOG_LINES
                  ? merged.slice(0, MAX_LOG_LINES)
                  : merged;
              knownIds.clear();
              for (const l of clipped) knownIds.add(l.id);
              return { lines: clipped };
            }

            const fresh: LogLine[] = [];
            for (const e of nextEntries) {
              if (knownIds.has(e.id)) continue;
              knownIds.add(e.id);
              fresh.push(e);
            }

            if (fresh.length === 0) {
              const currentTopId = state.lines[0]?.id ?? -1;
              if (maxIncomingId > currentTopId) {
                const newer = nextEntries.filter((e) => e.id > currentTopId);
                for (const e of newer) knownIds.add(e.id);
                const merged = [...newer.slice().reverse(), ...state.lines];
                return {
                  lines:
                    merged.length > MAX_LOG_LINES
                      ? merged.slice(0, MAX_LOG_LINES)
                      : merged,
                };
              }
            }

            const merged = [...fresh.reverse(), ...state.lines];
            const clipped =
              merged.length > MAX_LOG_LINES
                ? merged.slice(0, MAX_LOG_LINES)
                : merged;

            if (clipped.length < merged.length) {
              knownIds.clear();
              for (const l of clipped) knownIds.add(l.id);
            }

            if (fresh.length > 0) {
              maxSeenId = Math.max(maxSeenId, maxIncomingId);
            }

            return { lines: clipped };
          },
          false,
          "logs/applyIncoming",
        );
      },
    }),
    { name: "LogsStore" },
  ),
);

