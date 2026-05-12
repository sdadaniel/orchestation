import type { DocNode } from "@/hooks/useDocTree";
import type { NoticeSummaryData } from "@/hooks/useNoticeSummary";
import type { DocActions } from "@/components/Sidebar/types";
import type { TaskSummaryItem } from "@/store/tasksStore";

export interface InlineRenameProps {
  initialValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export interface NewItemInputProps {
  type: "doc" | "folder";
  onConfirm: (title: string) => void;
  onCancel: () => void;
}

export interface SidebarFooterProps {
  currentPath: string;
  collapsed?: boolean;
}

export interface TaskListSectionProps {
  summaryItems: TaskSummaryItem[];
  totalCount: number;
  currentPath: string;
  onStopTask?: (id: string) => Promise<void>;
}

export interface DocTreeNodeProps {
  node: DocNode;
  depth: number;
  currentPath: string;
  expandedFolders: Set<string>;
  toggleFolder: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onRename?: (id: string, title: string) => Promise<void>;
  onCreate?: (
    title: string,
    type: "doc" | "folder",
    parentId?: string | null,
  ) => Promise<void>;
  onReorder?: (
    nodeId: string,
    targetParentId: string | null,
    position: number,
  ) => Promise<void>;
  onReorderError?: (error: unknown) => void;
}

export interface DocsSectionProps {
  docTree: DocNode[];
  currentPath: string;
  docActions?: DocActions;
}

export interface NoticesSectionProps {
  noticeSummary: NoticeSummaryData;
  currentPath: string;
}
