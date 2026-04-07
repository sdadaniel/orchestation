"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { TaskFrontmatter } from "@/parser/parser";
import { getErrorMessage } from "@/lib/error-utils";
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
  patchRequest: (id: string, patch: Partial<Pick<RequestItem, "status" | "priority" | "title">>) => void;
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
          const tasksRes = await fetch("/api/tasks");
          if (!tasksRes.ok)
            throw new Error("데이터를 불러오는데 실패했습니다.");
          const tasks: TaskFrontmatter[] = await tasksRes.json();
          set(
            { groups: buildWaterfallGroups(tasks), tasksError: null },
            false,
            "tasks/fetchTasks/done",
          );
        } catch (err) {
          set(
            {
              tasksError: getErrorMessage(err, "알 수 없는 오류"),
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
              requestsError: getErrorMessage(err, "오류 발생"),
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

      patchRequest: (id, patch) => {
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        set(
          (state) => ({
            requests: state.requests.map((r) =>
              r.id === id ? { ...r, ...patch, updated: now } : r,
            ),
          }),
          false,
          "tasks/patchRequest",
        );
      },
    }),
    { name: "TasksStore" },
  ),
);

// 변경 감지는 SseProvider(전역 SSE 연결)가 담당 — 중복 폴링 제거됨
