"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { TaskFrontmatter } from "@/lib/parser";
import type { SprintResponse } from "@/lib/waterfall";
import { buildWaterfallGroups } from "@/lib/waterfall";
import type { WaterfallGroup } from "@/types/waterfall";

export interface RequestItem {
  id: string;
  title: string;
  status:
    | "pending"
    | "stopped"
    | "in_progress"
    | "reviewing"
    | "done"
    | "failed"
    | "rejected";
  priority: "high" | "medium" | "low";
  created: string;
  updated: string;
  content: string;
  scope: string[];
  sort_order: number;
}

interface TasksState {
  /* ── Tasks (WaterfallGroups) ── */
  groups: WaterfallGroup[];
  isTasksLoading: boolean;
  tasksError: string | null;

  /* ── Requests ── */
  requests: RequestItem[];
  isRequestsLoading: boolean;
  requestsError: string | null;

  /* ── Actions ── */
  fetchTasks: () => Promise<void>;
  fetchRequests: () => Promise<void>;
  fetchAll: () => Promise<void>;
  createRequest: (
    title: string,
    content: string,
    priority: string,
  ) => Promise<unknown>;
  updateRequest: (
    id: string,
    updates: Partial<
      Pick<RequestItem, "status" | "title" | "content" | "priority">
    >,
  ) => Promise<void>;
  deleteRequest: (id: string) => Promise<void>;
  reorderRequest: (id: string, direction: "up" | "down") => Promise<void>;
  stopTask: (id: string) => Promise<void>;
}

export const useTasksStore = create<TasksState>()(
  devtools(
    (set, get) => ({
      groups: [],
      isTasksLoading: true,
      tasksError: null,

      requests: [],
      isRequestsLoading: true,
      requestsError: null,

      fetchTasks: async () => {
        try {
          set({ isTasksLoading: true }, false, "tasks/fetchTasks/start");
          const [tasksRes, sprintsRes] = await Promise.all([
            fetch("/api/tasks"),
            fetch("/api/sprints"),
          ]);
          if (!tasksRes.ok || !sprintsRes.ok)
            throw new Error("데이터를 불러오는데 실패했습니다.");
          const tasks: TaskFrontmatter[] = await tasksRes.json();
          const sprints: SprintResponse[] = await sprintsRes.json();
          set(
            { groups: buildWaterfallGroups(tasks, sprints), tasksError: null },
            false,
            "tasks/fetchTasks/done",
          );
        } catch (err) {
          set(
            {
              tasksError:
                err instanceof Error ? err.message : "알 수 없는 오류",
            },
            false,
            "tasks/fetchTasks/error",
          );
        } finally {
          set({ isTasksLoading: false }, false, "tasks/fetchTasks/finally");
        }
      },

      fetchRequests: async () => {
        try {
          set(
            { isRequestsLoading: true },
            false,
            "tasks/fetchRequests/start",
          );
          const res = await fetch("/api/requests");
          if (!res.ok) throw new Error("요청 데이터를 불러오는데 실패했습니다.");
          const data: RequestItem[] = await res.json();
          set(
            { requests: data, requestsError: null },
            false,
            "tasks/fetchRequests/done",
          );
        } catch (err) {
          set(
            {
              requestsError:
                err instanceof Error ? err.message : "오류 발생",
            },
            false,
            "tasks/fetchRequests/error",
          );
        } finally {
          set(
            { isRequestsLoading: false },
            false,
            "tasks/fetchRequests/finally",
          );
        }
      },

      fetchAll: async () => {
        await Promise.all([get().fetchTasks(), get().fetchRequests()]);
      },

      createRequest: async (
        title: string,
        content: string,
        priority: string,
      ) => {
        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, priority }),
        });
        if (!res.ok) throw new Error("요청 생성에 실패했습니다.");
        const data = await res.json();
        await get().fetchRequests();
        return data;
      },

      updateRequest: async (id, updates) => {
        const res = await fetch(`/api/requests/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("요청 수정에 실패했습니다.");
        await get().fetchRequests();
      },

      deleteRequest: async (id) => {
        const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("요청 삭제에 실패했습니다.");
        await get().fetchRequests();
      },

      reorderRequest: async (id, direction) => {
        // Optimistic update: swap sort_order values
        set(
          (state) => {
            const target = state.requests.find((r) => r.id === id);
            if (!target) return state;
            const siblings = state.requests
              .filter((r) => r.status === target.status)
              .sort(
                (a, b) =>
                  (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
                  a.id.localeCompare(b.id),
              );
            const sibIdx = siblings.findIndex((r) => r.id === id);
            const swapSibIdx = direction === "up" ? sibIdx - 1 : sibIdx + 1;
            if (swapSibIdx < 0 || swapSibIdx >= siblings.length) return state;
            const other = siblings[swapSibIdx];
            const tmpOrder = target.sort_order;
            return {
              requests: state.requests.map((r) => {
                if (r.id === target.id) return { ...r, sort_order: other.sort_order };
                if (r.id === other.id) return { ...r, sort_order: tmpOrder };
                return r;
              }),
            };
          },
          false,
          "tasks/reorderRequest/optimistic",
        );

        // Persist to server; rollback on failure
        try {
          const res = await fetch(`/api/requests/${id}/reorder`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ direction }),
          });
          if (!res.ok) throw new Error();
        } catch {
          await get().fetchRequests();
        }
      },

      stopTask: async (id) => {
        try {
          await fetch(`/api/tasks/${id}/run`, { method: "DELETE" });
        } catch {
          // process may not exist
        }
        await get().updateRequest(id, { status: "stopped" });
      },
    }),
    { name: "TasksStore" },
  ),
);

/* ── Polling 기반 변경 감지 (SSE 제거 — 브라우저 로딩 스피너 방지) ── */

let pollConnected = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastSeen = Date.now();

async function pollForChanges() {
  try {
    const res = await fetch(`/api/tasks/watch?since=${lastSeen}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.changed) {
      lastSeen = data.lastChangedAt;
      useTasksStore.getState().fetchAll();
    }
  } catch { /* ignore */ }
}

export function startTasksSSE() {
  if (pollConnected || typeof window === "undefined") return;
  pollConnected = true;
  pollForChanges(); // 즉시 1회
  pollTimer = setInterval(pollForChanges, 5000); // 5초 간격
}

export function stopTasksSSE() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  pollConnected = false;
}

// 자동 시작 제거 — 컴포넌트에서 명시적으로 시작/정지할 것
// useEffect(() => { fetchAll(); startTasksSSE(); return stopTasksSSE; }, []);
