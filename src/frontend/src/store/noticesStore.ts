"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { getErrorMessage } from "@/lib/error-utils";

export interface NoticeItem {
  id: string;
  title: string;
  type: "info" | "warning" | "error" | "request";
  read: boolean;
  created: string;
  updated: string;
  content: string;
}

interface NoticesState {
  notices: NoticeItem[];
  isLoading: boolean;
  error: string | null;

  fetchNotices: () => Promise<void>;
  createNotice: (
    title: string,
    content: string,
    type: string,
  ) => Promise<unknown>;
  updateNotice: (
    id: string,
    updates: Partial<Pick<NoticeItem, "title" | "content" | "type" | "read">>,
  ) => Promise<void>;
  deleteNotice: (id: string) => Promise<void>;
}

export const useNoticesStore = create<NoticesState>()(
  devtools(
    (set, get) => ({
      notices: [],
      isLoading: true,
      error: null,

      fetchNotices: async () => {
        try {
          set({ isLoading: true }, false, "notices/fetch/start");
          const res = await fetch("/api/notices");
          if (!res.ok) throw new Error("알림을 불러오는데 실패했습니다.");
          const data: NoticeItem[] = await res.json();
          set(
            { notices: data, error: null },
            false,
            "notices/fetch/done",
          );
        } catch (err) {
          set(
            { error: getErrorMessage(err, "오류 발생") },
            false,
            "notices/fetch/error",
          );
        } finally {
          set({ isLoading: false }, false, "notices/fetch/finally");
        }
      },

      createNotice: async (title, content, type) => {
        const res = await fetch("/api/notices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, type }),
        });
        if (!res.ok) throw new Error("알림 생성에 실패했습니다.");
        const data = await res.json();
        await get().fetchNotices();
        return data;
      },

      updateNotice: async (id, updates) => {
        const res = await fetch(`/api/notices/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("알림 수정에 실패했습니다.");
        await get().fetchNotices();
      },

      deleteNotice: async (id) => {
        const res = await fetch(`/api/notices/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("알림 삭제에 실패했습니다.");
        await get().fetchNotices();
      },
    }),
    { name: "NoticesStore" },
  ),
);

// Auto-fetch in browser environment
if (typeof window !== "undefined") {
  useNoticesStore.getState().fetchNotices();
}
