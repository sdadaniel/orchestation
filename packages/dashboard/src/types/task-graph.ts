import type { TaskPriority, TaskStatus } from "@/entities/task";

/** `/api/tasks/graph` 한 항목 — 리스트/그래프/검색 공통 소스 */
export type TaskGraphItem = {
  id: string;
  display_id: string;
  title: string;
  status: TaskStatus;
  phase: string | null;
  priority: TaskPriority;
  depends_on: string[];
  blocks: string[];
  parallel_with: string[];
  role: string;
  scope: string[];
  content: string;
  created: string;
  updated: string;
  sort_order: number;
  branch: string;
};

/** 스토어·카드 컴포넌트에서 쓰는 목록 행 별칭 */
export type TaskListItem = TaskGraphItem;
