import type { TaskGraphItem } from "@/types/task-graph";

export async function fetchTaskGraphItems(): Promise<TaskGraphItem[]> {
  const res = await fetch("/api/tasks/graph");
  if (!res.ok) {
    throw new Error("데이터를 불러오는데 실패했습니다.");
  }
  return (await res.json()) as TaskGraphItem[];
}
