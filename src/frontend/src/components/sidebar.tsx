"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DollarSign,
  SquareTerminal,
  Folder,
  FileText,
  Plus,
  Activity,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "../../lib/constants";
import type { DocNode } from "@/hooks/useDocTree";
import { useTasksStore, type RequestItem } from "@/store/tasksStore";
import { useNotices } from "@/hooks/useNotices";
import type { NoticeItem } from "@/hooks/useNotices";
import type { WaterfallGroup } from "@/types/waterfall";

import { DocTreeNode } from "./sidebar/DocTreeNode";
import { NewItemInput } from "./sidebar/NewItemInput";
import { SidebarFooter } from "./sidebar/SidebarFooter";
import { TaskListSection } from "./sidebar/TaskListSection";

/* ── Types ── */

export type SidebarFilter =
  | { type: "all" }
  | { type: "prd"; prdId: string }
  | { type: "status"; status: TaskStatus };

type NavItem = {
  label: string;
  icon: React.ReactNode;
  href: string;
};

const pageNavItems: NavItem[] = [
  { label: "Task", icon: <ClipboardList className="h-3.5 w-3.5" />, href: "/" },
  {
    label: "Cost",
    icon: <DollarSign className="h-3.5 w-3.5" />,
    href: "/cost",
  },
  {
    label: "Monitor",
    icon: <Activity className="h-3.5 w-3.5" />,
    href: "/monitor",
  },
  {
    label: "Terminal",
    icon: <SquareTerminal className="h-3.5 w-3.5" />,
    href: "/terminal",
  },
];

/* ── Sidebar for IDE Task page ── */

export interface PrdInfo {
  id: string;
  title: string;
  status: string;
}

type TaskSidebarProps = {
  groups?: WaterfallGroup[];
  prds: PrdInfo[];
  docTree: DocNode[];
  filter?: SidebarFilter;
  onFilterChange?: (filter: SidebarFilter) => void;
  onDocCreate?: (
    title: string,
    type: "doc" | "folder",
    parentId?: string | null,
  ) => Promise<void>;
  onDocDelete?: (id: string) => Promise<void>;
  onDocRename?: (id: string, title: string) => Promise<void>;
  onDocReorder?: (
    nodeId: string,
    targetParentId: string | null,
    position: number,
  ) => Promise<void>;
  onDocReorderError?: (error: unknown) => void;
  requestItems?: RequestItem[];
  onNewTask?: (title: string, content: string) => Promise<void>;
  onStopTask?: (id: string) => Promise<void>;
  noticeItems?: NoticeItem[];
  currentPath?: string;
};

export function TaskSidebar({
  docTree,
  onDocCreate,
  onDocDelete,
  onDocRename,
  onDocReorder,
  onDocReorderError,
  requestItems: requestItemsProp,
  onStopTask,
  noticeItems: noticeItemsProp,
  currentPath: currentPathProp,
}: TaskSidebarProps) {
  // store에서 직접 구독 (props fallback)
  const storeRequests = useTasksStore((s) => s.requests);
  const storeStopTask = useTasksStore((s) => s.stopTask);
  const { notices: storeNotices } = useNotices();
  const pathname = usePathname();

  const requestItems = requestItemsProp ?? storeRequests ?? [];
  const noticeItems = noticeItemsProp ?? storeNotices ?? [];
  const currentPath = currentPathProp ?? pathname ?? "/";
  const handleStopTask = onStopTask ?? storeStopTask;
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [docsExpanded, setDocsExpanded] = useState(false);
  const [noticesExpanded, setNoticesExpanded] = useState(true);
  const [newRootItemType, setNewRootItemType] = useState<
    "doc" | "folder" | null
  >(null);
  const [showNewMenu, setShowNewMenu] = useState(false);

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreateRootItem = async (title: string) => {
    if (onDocCreate && newRootItemType) {
      await onDocCreate(title, newRootItemType, null);
    }
    setNewRootItemType(null);
  };

  return (
    <div className="ide-sidebar flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-3 h-10 border-b border-sidebar-border shrink-0">
        <Link
          href="/"
          className="text-sm font-semibold text-sidebar-foreground no-underline hover:text-primary transition-colors"
        >
          Home
        </Link>
      </div>

      <div
        className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2"
        style={{ scrollbarWidth: "none" }}
      >
        {/* ── Docs (문서 트리) ── */}
        <div className="mb-2">
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <button
              type="button"
              className="flex items-center gap-1 sidebar-section-link bg-transparent border-none p-0 cursor-pointer"
              onClick={() => setDocsExpanded((v) => !v)}
            >
              {docsExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Docs
            </button>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">
                {docTree.length}
              </span>
              {docsExpanded && (
                <div className="relative">
                  <button
                    type="button"
                    title="New document or folder"
                    className="p-0.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNewMenu(!showNewMenu)}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  {showNewMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-sidebar border border-sidebar-border rounded shadow-lg z-50 py-1 min-w-[120px]">
                      <button
                        type="button"
                        className="w-full text-left px-3 py-1 text-xs hover:bg-sidebar-accent flex items-center gap-2"
                        onClick={() => {
                          setNewRootItemType("doc");
                          setShowNewMenu(false);
                        }}
                      >
                        <FileText className="h-3 w-3" />
                        New Document
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-1 text-xs hover:bg-sidebar-accent flex items-center gap-2"
                        onClick={() => {
                          setNewRootItemType("folder");
                          setShowNewMenu(false);
                        }}
                      >
                        <Folder className="h-3 w-3" />
                        New Folder
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Collapsible doc tree content */}
          <div
            className={cn(
              "sidebar-collapsible",
              docsExpanded && "sidebar-collapsible-open",
            )}
          >
            <div className="sidebar-collapsible-inner">
              {/* New root item input */}
              {newRootItemType && (
                <NewItemInput
                  type={newRootItemType}
                  onConfirm={handleCreateRootItem}
                  onCancel={() => setNewRootItemType(null)}
                />
              )}

              {/* Doc tree */}
              {docTree.map((node) => (
                <DocTreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  currentPath={currentPath}
                  expandedFolders={expandedFolders}
                  toggleFolder={toggleFolder}
                  onDelete={onDocDelete}
                  onRename={onDocRename}
                  onCreate={onDocCreate}
                  onReorder={onDocReorder}
                  onReorderError={onDocReorderError}
                />
              ))}

              {docTree.length === 0 && !newRootItemType && (
                <div className="px-2 py-2 text-[11px] text-muted-foreground">
                  No documents yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tasks ── */}
        <TaskListSection
          requestItems={requestItems}
          currentPath={currentPath}
          onStopTask={handleStopTask}
        />

        {/* ── Notices ── */}
        <div className="mb-2">
          <div className="sidebar-section-sep" />
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <button
              type="button"
              className="flex items-center gap-1 sidebar-section-link bg-transparent border-none p-0 cursor-pointer"
              onClick={() => setNoticesExpanded((v) => !v)}
            >
              <ChevronDown
                className="h-3 w-3 transition-transform duration-200"
                style={{
                  transform: noticesExpanded
                    ? "rotate(0deg)"
                    : "rotate(-90deg)",
                }}
              />
              <Link
                href="/notices"
                className={cn(
                  "sidebar-section-link",
                  currentPath === "/notices" && "active",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                Notices
              </Link>
            </button>
            {noticeItems.filter((n) => !n.read).length > 0 ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold leading-tight">
                {noticeItems.filter((n) => !n.read).length}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                {noticeItems.length}
              </span>
            )}
          </div>

          {/* Collapsible notices content */}
          <div
            className={cn(
              "sidebar-collapsible",
              noticesExpanded && "sidebar-collapsible-open",
            )}
          >
            <div className="sidebar-collapsible-inner">
              {noticeItems
                .filter((n) => !n.read)
                .slice(0, 5)
                .map((notice) => (
                  <Link
                    key={notice.id}
                    href="/notices"
                    className={cn(
                      "tree-item w-full text-left no-underline text-sidebar-foreground",
                    )}
                  >
                    <Bell className="h-3 w-3 shrink-0 text-primary" />
                    <span className="truncate flex-1 text-xs font-medium">
                      {notice.title}
                    </span>
                  </Link>
                ))}
              {noticeItems.filter((n) => !n.read).length === 0 &&
                noticeItems.length > 0 && (
                  <div className="px-2 py-1 text-[11px] text-muted-foreground">
                    All read
                  </div>
                )}
              {noticeItems.length === 0 && (
                <div className="px-2 py-1 text-[11px] text-muted-foreground">
                  No notices
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Cost + Terminal + Settings */}
      <SidebarFooter currentPath={currentPath} />
    </div>
  );
}

/* ── Simple sidebar for non-Task pages ── */

export function PageSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-48 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-3 py-3">
        <h1 className="text-sm font-semibold text-sidebar-foreground">
          Dashboard
        </h1>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {pageNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "tree-item text-sidebar-foreground no-underline",
                isActive && "active",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
