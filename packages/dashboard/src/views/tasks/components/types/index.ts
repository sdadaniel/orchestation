import type { TaskGraphItem } from "@/types/task-graph";

export interface ChainGroupProps {
  items: TaskGraphItem[];
  onUpdate: (
    id: string,
    updates: Partial<
      Pick<TaskGraphItem, "status" | "title" | "content" | "priority">
    >,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder?: (id: string, direction: "up" | "down") => Promise<void>;
  isFirst?: boolean;
  isLast?: boolean;
}

export type CardTab = "content" | "scope" | "ai-result" | "logs";

export type NodeLayout = {
  id: string;
  x: number;
  y: number;
  req: TaskGraphItem;
  isNextUp: boolean;
};

export type EdgeLayout = {
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type SectionLayout = {
  key: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  extra: number;
};
