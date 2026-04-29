import type { DocNode } from "@/hooks/useDocTree";
import type { NoticeItem } from "@/hooks/useNotices";
import type { RequestItem } from "@/store/tasksStore";
import type { WaterfallGroup } from "@/types/waterfall";

export interface PrdInfo {
  id: string;
  title: string;
  status: string;
}

export type DocActions = {
  create: (
    title: string,
    type: "doc" | "folder",
    parentId?: string | null,
  ) => Promise<void>;
  delete: (id: string) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  reorder: (
    nodeId: string,
    targetParentId: string | null,
    position: number,
  ) => Promise<void>;
  reorderError: (error: unknown) => void | Promise<void>;
};

export type SidebarProps = {
  groups?: WaterfallGroup[];
  prds?: PrdInfo[];
  docTree: DocNode[];
  docActions?: DocActions;
  requestItems?: RequestItem[];
  onNewTask?: (title: string, content: string) => Promise<void>;
  onStopTask?: (id: string) => Promise<void>;
  noticeItems?: NoticeItem[];
  currentPath?: string;
};
