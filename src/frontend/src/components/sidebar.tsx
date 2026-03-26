"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DollarSign,
  SquareTerminal,
  Settings,
  FolderOpen,
  Folder,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Activity,
  Square,
  Loader2,
  Bell,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import type { WaterfallGroup } from "@/types/waterfall";
import {
  STATUS_STYLES,
  type TaskStatus,
} from "../../lib/constants";
import type { DocNode } from "@/hooks/useDocTree";
import { useTasksStore, type RequestItem } from "@/store/tasksStore";
import { useNotices } from "@/hooks/useNotices";
import type { NoticeItem } from "@/hooks/useNotices";

/* ── Types ── */

export type SidebarFilter =
  | { type: "all" }
  | { type: "prd"; prdId: string }
  | { type: "sprint"; sprintId: string }
  | { type: "status"; status: TaskStatus };

type NavItem = {
  label: string;
  icon: React.ReactNode;
  href: string;
};

const pageNavItems: NavItem[] = [
  { label: "Task", icon: <ClipboardList className="h-3.5 w-3.5" />, href: "/" },
  { label: "Cost", icon: <DollarSign className="h-3.5 w-3.5" />, href: "/cost" },
  { label: "Monitor", icon: <Activity className="h-3.5 w-3.5" />, href: "/monitor" },
  { label: "Terminal", icon: <SquareTerminal className="h-3.5 w-3.5" />, href: "/terminal" },
];

/* ── Sidebar for IDE Task page ── */

export interface PrdInfo {
  id: string;
  title: string;
  status: string;
  sprints: string[];
}

type TaskSidebarProps = {
  groups?: WaterfallGroup[];
  prds: PrdInfo[];
  docTree: DocNode[];
  filter?: SidebarFilter;
  onFilterChange?: (filter: SidebarFilter) => void;
  onDocCreate?: (title: string, type: "doc" | "folder", parentId?: string | null) => Promise<void>;
  onDocDelete?: (id: string) => Promise<void>;
  onDocRename?: (id: string, title: string) => Promise<void>;
  onDocReorder?: (nodeId: string, targetParentId: string | null, position: number) => Promise<void>;
  onDocReorderError?: (error: unknown) => void;
  requestItems?: RequestItem[];
  onNewTask?: (title: string, content: string) => Promise<void>;
  onStopTask?: (id: string) => Promise<void>;
  noticeItems?: NoticeItem[];
  currentPath?: string;
};

/* ── Inline rename input ── */
function InlineRename({
  initialValue,
  onConfirm,
  onCancel,
}: {
  initialValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <Input
      ref={inputRef}
      type="text"
      size="sm"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value.trim()) onConfirm(value.trim());
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => {
        if (value.trim()) onConfirm(value.trim());
        else onCancel();
      }}
      className="border-primary px-1 py-0"
    />
  );
}

/* ── New item inline input ── */
function NewItemInput({
  type,
  onConfirm,
  onCancel,
}: {
  type: "doc" | "folder";
  onConfirm: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="tree-item">
      {type === "folder" ? (
        <Folder className="h-3 w-3 text-muted-foreground shrink-0" />
      ) : (
        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
      )}
      <Input
        ref={inputRef}
        type="text"
        size="sm"
        value={value}
        placeholder={type === "folder" ? "New folder..." : "New document..."}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onConfirm(value.trim());
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => {
          if (value.trim()) onConfirm(value.trim());
          else onCancel();
        }}
        className="border-primary px-1 py-0 flex-1"
      />
    </div>
  );
}

/* ── Single tree node (with drag & drop) ── */
function DocTreeNode({
  node,
  depth,
  currentPath,
  expandedFolders,
  toggleFolder,
  onDelete,
  onRename,
  onCreate,
  onReorder,
  onReorderError,
}: {
  node: DocNode;
  depth: number;
  currentPath: string;
  expandedFolders: Set<string>;
  toggleFolder: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onRename?: (id: string, title: string) => Promise<void>;
  onCreate?: (title: string, type: "doc" | "folder", parentId?: string | null) => Promise<void>;
  onReorder?: (nodeId: string, targetParentId: string | null, position: number) => Promise<void>;
  onReorderError?: (error: unknown) => void;
}) {
  const { addToast } = useToast();
  const [isRenaming, setIsRenaming] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [newItemType, setNewItemType] = useState<"doc" | "folder" | null>(null);
  const [dragOver, setDragOver] = useState<"above" | "inside" | "below" | null>(null);
  const isFolder = node.type === "folder";
  const isExpanded = expandedFolders.has(node.id);
  const isActive = currentPath === `/docs/${node.id}`;

  const handleRename = async (title: string) => {
    if (onRename) await onRename(node.id, title);
    setIsRenaming(false);
  };

  const handleDelete = async () => {
    if (onDelete) await onDelete(node.id);
  };

  const handleCreateChild = async (title: string) => {
    if (onCreate && newItemType) {
      await onCreate(title, newItemType, node.id);
      if (!isExpanded) toggleFolder(node.id);
    }
    setNewItemType(null);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;

    if (isFolder && y > h * 0.25 && y < h * 0.75) {
      setDragOver("inside");
    } else if (y < h * 0.5) {
      setDragOver("above");
    } else {
      setDragOver("below");
    }
  };

  const handleDragLeave = () => setDragOver(null);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === node.id || !onReorder) {
      setDragOver(null);
      return;
    }

    try {
      if (dragOver === "inside" && isFolder) {
        await onReorder(draggedId, node.id, 0);
        if (!isExpanded) toggleFolder(node.id);
      } else if (dragOver === "above") {
        await onReorder(draggedId, node.id, -1);
      } else if (dragOver === "below") {
        await onReorder(draggedId, node.id, 1);
      }
    } catch (err) {
      console.error("Reorder failed:", err);
      addToast("문서 순서 변경에 실패했습니다.", "error");
      // Delegate to parent for state rollback/refetch
      onReorderError?.(err);
    } finally {
      setDragOver(null);
    }
  };

  const paddingLeft = 8 + depth * 12;

  const dropIndicator = dragOver === "above"
    ? "border-t-2 border-primary"
    : dragOver === "below"
    ? "border-b-2 border-primary"
    : dragOver === "inside"
    ? "bg-primary/20 ring-1 ring-primary/40 rounded"
    : "";

  return (
    <div>
      <div
        className={cn("relative group", dropIndicator)}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isFolder ? (
          <div
            className={cn("tree-item", isActive && "active")}
            style={{ paddingLeft }}
            onClick={() => toggleFolder(node.id)}
          >
            <button
              type="button"
              className="shrink-0 p-0 bg-transparent border-none cursor-pointer text-muted-foreground"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {isExpanded ? (
              <FolderOpen className="h-3 w-3 text-primary shrink-0" />
            ) : (
              <Folder className="h-3 w-3 text-primary shrink-0" />
            )}
            {isRenaming ? (
              <InlineRename
                initialValue={node.title}
                onConfirm={handleRename}
                onCancel={() => setIsRenaming(false)}
              />
            ) : (
              <span className="truncate flex-1 text-xs">{node.title}</span>
            )}
          </div>
        ) : (
          <Link
            href={`/docs/${node.id}`}
            className={cn("tree-item no-underline text-sidebar-foreground", isActive && "active")}
            style={{ paddingLeft }}
            draggable={false}
          >
            <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
            {isRenaming ? (
              <InlineRename
                initialValue={node.title}
                onConfirm={handleRename}
                onCancel={() => setIsRenaming(false)}
              />
            ) : (
              <span className="truncate flex-1 text-xs">{node.title}</span>
            )}
          </Link>
        )}

        {/* Hover actions — hide for readonly nodes */}
        {showActions && !isRenaming && !node.readonly && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-sidebar rounded px-0.5">
            {isFolder && (
              <>
                <button
                  type="button"
                  title="New document"
                  className="p-0.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); setNewItemType("doc"); if (!isExpanded) toggleFolder(node.id); }}
                >
                  <FileText className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  title="New folder"
                  className="p-0.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); setNewItemType("folder"); if (!isExpanded) toggleFolder(node.id); }}
                >
                  <Folder className="h-2.5 w-2.5" />
                </button>
              </>
            )}
            <button
              type="button"
              title="Rename"
              className="p-0.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIsRenaming(true); }}
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              title="Delete"
              className="p-0.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-red-400"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDelete(); }}
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {isFolder && isExpanded && (
        <div>
          {newItemType && (
            <div style={{ paddingLeft: paddingLeft + 12 }}>
              <NewItemInput
                type={newItemType}
                onConfirm={handleCreateChild}
                onCancel={() => setNewItemType(null)}
              />
            </div>
          )}
          {node.children.map((child) => (
            <DocTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              currentPath={currentPath}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              onDelete={onDelete}
              onRename={onRename}
              onCreate={onCreate}
              onReorder={onReorder}
              onReorderError={onReorderError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [docsExpanded, setDocsExpanded] = useState(false);
  const [newRootItemType, setNewRootItemType] = useState<"doc" | "folder" | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [stoppingTaskId, setStoppingTaskId] = useState<string | null>(null);
  // showNewTaskForm, newTaskTitle, newTaskContent removed - now using /tasks/new page

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

  // 사이드바 태스크: in_progress 최상단 → 나머지는 최근 updated 순
  const uniqueItems = [...new Map(requestItems.map((r) => [r.id, r])).values()];
  const statusWeight = (s: string) => s === "in_progress" ? 0 : s === "reviewing" ? 1 : s === "pending" ? 2 : s === "stopped" ? 3 : 9;
  const recentItems = uniqueItems
    .sort((a, b) => statusWeight(a.status) - statusWeight(b.status) || (b.updated ?? b.created).localeCompare(a.updated ?? a.created))
    .slice(0, 15);

  // Group recent items by status for sidebar display
  const inProgressTasks = recentItems.filter((r) => r.status === "in_progress");
  const stoppedTasks = recentItems.filter((r) => r.status === "stopped");
  const pendingTasks = recentItems.filter((r) => r.status === "pending");
  const reviewingTasks = recentItems.filter((r) => r.status === "reviewing");
  const doneTasks = recentItems.filter((r) => r.status === "done");
  const rejectedTasks = recentItems.filter((r) => r.status === "rejected");

  return (
    <div className="ide-sidebar flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-3 h-10 border-b border-sidebar-border shrink-0">
        <Link href="/" className="text-sm font-semibold text-sidebar-foreground no-underline hover:text-primary transition-colors">
          Home
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2" style={{ scrollbarWidth: "none" }}>

        {/* ── Docs (문서 트리) ── */}
        <div className="mb-2">
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <button
              type="button"
              className="flex items-center gap-1 sidebar-section-link bg-transparent border-none p-0 cursor-pointer"
              onClick={() => setDocsExpanded((v) => !v)}
            >
              {docsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Docs
            </button>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">{docTree.length}</span>
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
                        onClick={() => { setNewRootItemType("doc"); setShowNewMenu(false); }}
                      >
                        <FileText className="h-3 w-3" />
                        New Document
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-1 text-xs hover:bg-sidebar-accent flex items-center gap-2"
                        onClick={() => { setNewRootItemType("folder"); setShowNewMenu(false); }}
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
          <div className={cn("sidebar-collapsible", docsExpanded && "sidebar-collapsible-open")}>
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

        {/* ── Tasks (merged from Requests) ── */}
        <div className="mb-2">
          <div className="sidebar-section-sep" />
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <Link
              href="/tasks"
              className={cn("sidebar-section-link", currentPath.startsWith("/tasks") && "active")}
            >
              Tasks
            </Link>
            <span className={cn("text-[10px] font-medium tabular-nums px-1 rounded", currentPath.startsWith("/tasks") ? "text-primary" : "text-muted-foreground")}>
              {requestItems.length}
            </span>
          </div>

          {/* In Progress tasks */}
          {inProgressTasks.map((task) => {
            const taskDisplayId = task.id;
            const isExpanded = expandedTaskId === task.id;
            return (
              <div key={task.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  className={cn("tree-item w-full text-left pr-7", currentPath === `/tasks/${taskDisplayId}` && "active")}
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <span className="w-3 h-3 shrink-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="truncate flex-1 text-xs">{taskDisplayId} {task.title}</span>
                </button>
                {handleStopTask && (
                  stoppingTaskId === task.id ? (
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-red-400">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      title="중지"
                      onClick={async (e) => {
                        e.stopPropagation();
                        setStoppingTaskId(task.id);
                        try { await handleStopTask(task.id); } finally { setStoppingTaskId(null); }
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Square className="h-2.5 w-2.5" />
                    </button>
                  )
                )}
                {isExpanded && (
                  <Link
                    href={`/tasks/${taskDisplayId}`}
                    className="block ml-6 mr-1 my-0.5 px-2 py-1.5 rounded text-[11px] text-muted-foreground bg-sidebar-accent/50 hover:bg-sidebar-accent hover:text-foreground no-underline transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={cn("px-1 py-0 rounded text-[9px] font-medium", STATUS_STYLES[task.status as TaskStatus]?.bg || "bg-muted", "text-white")}>
                        {task.status}
                      </span>
                    </div>
                    <p className="truncate">{task.title}</p>
                    <span className="text-[10px] text-muted-foreground/70">Click to open detail →</span>
                  </Link>
                )}
              </div>
            );
          })}

          {/* Stopped tasks */}
          {stoppedTasks.map((task) => {
            const taskDisplayId = task.id;
            const isExpanded = expandedTaskId === task.id;
            return (
              <div key={task.id}>
                <button
                  type="button"
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  className={cn("tree-item w-full text-left", currentPath === `/tasks/${taskDisplayId}` && "active")}
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <span className="w-2 h-2 rounded-full shrink-0 bg-violet-500" />
                  <span className="truncate flex-1 text-xs">{taskDisplayId} {task.title}</span>
                </button>
                {isExpanded && (
                  <Link
                    href={`/tasks/${taskDisplayId}`}
                    className="block ml-6 mr-1 my-0.5 px-2 py-1.5 rounded text-[11px] text-muted-foreground bg-sidebar-accent/50 hover:bg-sidebar-accent hover:text-foreground no-underline transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={cn("px-1 py-0 rounded text-[9px] font-medium", STATUS_STYLES[task.status as TaskStatus]?.bg || "bg-muted", "text-white text-[9px]")}>
                        {task.status}
                      </span>
                    </div>
                    <p className="truncate">{task.title}</p>
                    <span className="text-[10px] text-muted-foreground/70">Click to open detail →</span>
                  </Link>
                )}
              </div>
            );
          })}

          {/* Pending tasks */}
          {pendingTasks.map((task) => {
            const taskDisplayId = task.id;
            const isExpanded = expandedTaskId === task.id;
            return (
              <div key={task.id}>
                <button
                  type="button"
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  className={cn("tree-item w-full text-left", currentPath === `/tasks/${taskDisplayId}` && "active")}
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <span className="w-2 h-2 rounded-full shrink-0 bg-yellow-500" />
                  <span className="truncate flex-1 text-xs">{taskDisplayId} {task.title}</span>
                </button>
                {isExpanded && (
                  <Link
                    href={`/tasks/${taskDisplayId}`}
                    className="block ml-6 mr-1 my-0.5 px-2 py-1.5 rounded text-[11px] text-muted-foreground bg-sidebar-accent/50 hover:bg-sidebar-accent hover:text-foreground no-underline transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={cn("px-1 py-0 rounded text-[9px] font-medium", STATUS_STYLES[task.status as TaskStatus]?.bg || "bg-muted", "text-white")}>
                        {task.status}
                      </span>
                    </div>
                    <p className="truncate">{task.title}</p>
                    <span className="text-[10px] text-muted-foreground/70">Click to open detail →</span>
                  </Link>
                )}
              </div>
            );
          })}

          {/* Reviewing tasks */}
          {reviewingTasks.map((task) => {
            const taskDisplayId = task.id;
            const isExpanded = expandedTaskId === task.id;
            return (
              <div key={task.id}>
                <button
                  type="button"
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  className={cn("tree-item w-full text-left", currentPath === `/tasks/${taskDisplayId}` && "active")}
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <span className="w-2 h-2 rounded-full shrink-0 bg-orange-500" />
                  <span className="truncate flex-1 text-xs">{taskDisplayId} {task.title}</span>
                </button>
                {isExpanded && (
                  <Link
                    href={`/tasks/${taskDisplayId}`}
                    className="block ml-6 mr-1 my-0.5 px-2 py-1.5 rounded text-[11px] text-muted-foreground bg-sidebar-accent/50 hover:bg-sidebar-accent hover:text-foreground no-underline transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={cn("px-1 py-0 rounded text-[9px] font-medium", STATUS_STYLES[task.status as TaskStatus]?.bg || "bg-muted", "text-white text-[9px]")}>
                        {task.status}
                      </span>
                    </div>
                    <p className="truncate">{task.title}</p>
                    <span className="text-[10px] text-muted-foreground/70">Click to open detail →</span>
                  </Link>
                )}
              </div>
            );
          })}

          {/* Rejected tasks */}
          {rejectedTasks.map((task) => {
            const taskDisplayId = task.id;
            const isExpanded = expandedTaskId === task.id;
            return (
              <div key={task.id}>
                <button
                  type="button"
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  className={cn("tree-item w-full text-left", currentPath === `/tasks/${taskDisplayId}` && "active")}
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <span className="w-2 h-2 rounded-full shrink-0 bg-red-500" />
                  <span className="truncate flex-1 text-xs">{taskDisplayId} {task.title}</span>
                </button>
                {isExpanded && (
                  <Link
                    href={`/tasks/${taskDisplayId}`}
                    className="block ml-6 mr-1 my-0.5 px-2 py-1.5 rounded text-[11px] text-muted-foreground bg-sidebar-accent/50 hover:bg-sidebar-accent hover:text-foreground no-underline transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={cn("px-1 py-0 rounded text-[9px] font-medium", STATUS_STYLES[task.status as TaskStatus]?.bg || "bg-muted", "text-white")}>
                        {task.status}
                      </span>
                    </div>
                    <p className="truncate">{task.title}</p>
                    <span className="text-[10px] text-muted-foreground/70">Click to open detail →</span>
                  </Link>
                )}
              </div>
            );
          })}

          {/* Done tasks - collapsed by default */}
          {doneTasks.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowCompleted(!showCompleted)}
                className="tree-item w-full text-left"
              >
                {showCompleted ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <span className="text-[11px] text-muted-foreground flex-1">
                  Show completed ({doneTasks.length})
                </span>
              </button>
              {showCompleted && doneTasks.map((task) => {
                const taskDisplayId = task.id;
                const isExpanded = expandedTaskId === task.id;
                return (
                  <div key={task.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      className={cn("tree-item w-full text-left ml-3", currentPath === `/tasks/${taskDisplayId}` && "active")}
                    >
                      {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                      <span className="text-emerald-500 text-xs shrink-0">&#10003;</span>
                      <span className="truncate flex-1 text-xs text-muted-foreground line-through">
                        {taskDisplayId} {task.title}
                      </span>
                    </button>
                    {isExpanded && (
                      <Link
                        href={`/tasks/${taskDisplayId}`}
                        className="block ml-9 mr-1 my-0.5 px-2 py-1.5 rounded text-[11px] text-muted-foreground bg-sidebar-accent/50 hover:bg-sidebar-accent hover:text-foreground no-underline transition-colors"
                      >
                        <p className="truncate">{task.title}</p>
                        <span className="text-[10px] text-muted-foreground/70">Click to open detail →</span>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* + New Task button */}
          <Link
            href="/tasks/new"
            className={cn("tree-item w-full text-left text-muted-foreground hover:text-foreground no-underline", currentPath === "/tasks/new" && "active")}
          >
            <Plus className="h-3 w-3 shrink-0" />
            <span className="text-xs">New Task</span>
          </Link>

          {requestItems.length === 0 && (
            <div className="px-2 py-2 text-[11px] text-muted-foreground">
              No tasks yet
            </div>
          )}
        </div>

        {/* ── Notices ── */}
        <div className="mb-2">
          <div className="sidebar-section-sep" />
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <Link
              href="/notices"
              className={cn("sidebar-section-link", currentPath === "/notices" && "active")}
            >
              Notices
            </Link>
            {noticeItems.filter((n) => !n.read).length > 0 ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold leading-tight">
                {noticeItems.filter((n) => !n.read).length}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">{noticeItems.length}</span>
            )}
          </div>
          {noticeItems.filter((n) => !n.read).slice(0, 5).map((notice) => (
            <Link
              key={notice.id}
              href="/notices"
              className={cn("tree-item w-full text-left no-underline text-sidebar-foreground")}
            >
              <Bell className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate flex-1 text-xs font-medium">{notice.title}</span>
            </Link>
          ))}
          {noticeItems.filter((n) => !n.read).length === 0 && noticeItems.length > 0 && (
            <div className="px-2 py-1 text-[11px] text-muted-foreground">All read</div>
          )}
          {noticeItems.length === 0 && (
            <div className="px-2 py-1 text-[11px] text-muted-foreground">No notices</div>
          )}
        </div>
      </div>

      {/* Bottom: Cost + Terminal + Settings */}
      <div className="border-t border-sidebar-border px-2 pt-2 pb-3 flex flex-col gap-0.5">
        <Link href="/cost" className={cn("tree-item text-sidebar-foreground no-underline", currentPath === "/cost" && "active")}>
          <DollarSign className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs">Cost</span>
        </Link>
        <Link href="/monitor" className={cn("tree-item text-sidebar-foreground no-underline", currentPath === "/monitor" && "active")}>
          <Activity className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs">Monitor</span>
        </Link>
        <Link href="/terminal" className={cn("tree-item text-sidebar-foreground no-underline", currentPath === "/terminal" && "active")}>
          <SquareTerminal className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs">Terminal</span>
        </Link>
        <Link href="/night-worker" className={cn("tree-item text-sidebar-foreground no-underline", currentPath === "/night-worker" && "active")}>
          <Moon className="h-3.5 w-3.5" />
          <span>Night Worker</span>
        </Link>
        <Link href="/settings" className={cn("tree-item text-sidebar-foreground no-underline", currentPath === "/settings" && "active")}>
          <Settings className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs">Settings</span>
        </Link>
      </div>
    </div>
  );
}

/* ── Simple sidebar for non-Task pages ── */

export function PageSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-48 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-3 py-3">
        <h1 className="text-sm font-semibold text-sidebar-foreground">Dashboard</h1>
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
