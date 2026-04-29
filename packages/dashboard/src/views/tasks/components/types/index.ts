import type { RequestItem } from "@/store/tasksStore";

export interface ChainGroupProps {
  items: RequestItem[];
  onUpdate: (
    id: string,
    updates: Partial<
      Pick<RequestItem, "status" | "title" | "content" | "priority">
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
  req: RequestItem;
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
