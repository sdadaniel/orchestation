"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { TaskPriority, TaskStatus } from "@/entities/task";
import { getErrorMessage } from "@/lib/errors/error-utils";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query/query-keys";
import type { TaskGraphItem } from "@/types/task-graph";

export type TaskSummaryItem = {
  id: string;
  display_id?: string;
  title: string;
  status: TaskStatus;
  created: string;
  updated: string;
};

export interface TaskSummaryCounts {
  pending: number;
  reviewing: number;
  in_progress: number;
  failed: number;
  rejected: number;
  done: number;
  stopped: number;
  total: number;
}

export interface TaskSummaryData {
  items: TaskSummaryItem[];
  total: number;
  page: number;
  size: number;
  counts: TaskSummaryCounts;
  active: TaskSummaryItem[];
  pending: TaskSummaryItem[];
}

function invalidateTaskQueries() {
  void getQueryClient().invalidateQueries({ queryKey: queryKeys.tasks.all });
}

interface TasksState {
  tasksSummary: TaskSummaryData;
  isTasksSummaryLoading: boolean;
  tasksSummaryError: string | null;

  fetchTasksSummary: () => Promise<void>;
  createTask: (
    title: string,
    content: string,
    priority: string,
  ) => Promise<unknown>;
  updateTask: (
    id: string,
    updates: Partial<
      Pick<TaskGraphItem, "status" | "title" | "content" | "priority">
    >,
  ) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  reorderTask: (id: string, direction: "up" | "down") => Promise<void>;
  stopTask: (id: string) => Promise<void>;
}

export const useTasksStore = create<TasksState>()(
  devtools(
    (set, get) => ({
      tasksSummary: {
        items: [],
        total: 0,
        page: 1,
        size: 10,
        counts: {
          pending: 0,
          reviewing: 0,
          in_progress: 0,
          failed: 0,
          rejected: 0,
          done: 0,
          stopped: 0,
          total: 0,
        },
        active: [],
        pending: [],
      },
      isTasksSummaryLoading: true,
      tasksSummaryError: null,

      fetchTasksSummary: async () => {
        try {
          set(
            { isTasksSummaryLoading: true },
            false,
            "tasks/fetchTasksSummary/start",
          );
          const res = await fetch("/api/tasks?page=1&size=10&summary=1");
          if (!res.ok)
            throw new Error("요약 태스크 데이터를 불러오는데 실패했습니다.");
          const data: TaskSummaryData = await res.json();
          set(
            { tasksSummary: data, tasksSummaryError: null },
            false,
            "tasks/fetchTasksSummary/done",
          );
        } catch (err) {
          set(
            {
              tasksSummaryError: getErrorMessage(err, "오류 발생"),
            },
            false,
            "tasks/fetchTasksSummary/error",
          );
        } finally {
          set(
            { isTasksSummaryLoading: false },
            false,
            "tasks/fetchTasksSummary/finally",
          );
        }
      },

      createTask: async (title: string, content: string, priority: string) => {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, priority }),
        });
        if (!res.ok) throw new Error("태스크 생성에 실패했습니다.");
        const data = await res.json();
        await get().fetchTasksSummary();
        invalidateTaskQueries();
        return data;
      },

      updateTask: async (id, updates) => {
        const res = await fetch(`/api/tasks/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("태스크 수정에 실패했습니다.");
        await get().fetchTasksSummary();
        invalidateTaskQueries();
      },

      deleteTask: async (id) => {
        const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("태스크 삭제에 실패했습니다.");
        await get().fetchTasksSummary();
        invalidateTaskQueries();
      },

      reorderTask: async (id, direction) => {
        const qc = getQueryClient();
        const key = queryKeys.tasks.graph();

        qc.setQueryData<TaskGraphItem[]>(key, (old) => {
          if (!old) return old;
          const target = old.find((r) => r.id === id);
          if (!target) return old;
          const siblings = old
            .filter((r) => r.status === target.status)
            .sort(
              (a, b) =>
                (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
                a.id.localeCompare(b.id),
            );
          const sibIdx = siblings.findIndex((r) => r.id === id);
          const swapSibIdx = direction === "up" ? sibIdx - 1 : sibIdx + 1;
          if (swapSibIdx < 0 || swapSibIdx >= siblings.length) return old;
          const other = siblings[swapSibIdx];
          const tmpOrder = target.sort_order;
          return old.map((r) => {
            if (r.id === target.id)
              return { ...r, sort_order: other.sort_order };
            if (r.id === other.id) return { ...r, sort_order: tmpOrder };
            return r;
          });
        });

        try {
          const res = await fetch(`/api/tasks/${id}/reorder`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ direction }),
          });
          if (!res.ok) throw new Error();
        } catch {
          invalidateTaskQueries();
          await get().fetchTasksSummary();
        }
      },

      stopTask: async (id) => {
        try {
          await fetch(`/api/tasks/${id}/run`, { method: "DELETE" });
        } catch {
          // process may not exist
        }
        await get().updateTask(id, { status: "stopped" });
      },
    }),
    { name: "TasksStore" },
  ),
);
