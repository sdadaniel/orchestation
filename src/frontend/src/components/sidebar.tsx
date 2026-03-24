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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WaterfallGroup } from "@/types/waterfall";
import {
  STATUS_STYLES,
  type TaskStatus,
} from "../../lib/constants";
import type { DocNode } from "@/hooks/useDocTree";
import type { RequestItem } from "@/hooks/useRequests";

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
  groups: WaterfallGroup[];
  prds: PrdInfo[];
  docTree: DocNode[];
  filter: SidebarFilter;
  onFilterChange: (filter: SidebarFilter) => void;
  onDocCreate?: (title: string, type: "doc" | "folder", parentId?: string | null) => Promise<void>;
  onDocDelete?: (id: string) => Promise<void>;
  onDocRename?: (id: string, title: string) => Promise<void>;
  onDocReorder?: (nodeId: string, targetParentId: string | null, position: number) => Promise<void>;
  requestItems?: RequestItem[];
  onNewTask?: (title: string, content: string) => Promise<void>;
  onStopTask?: (id: string) => Promise<void>;
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
    <input
      ref={inputRef}
      type="text"
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
      className="bg-muted border border-primary rounded px-1 py-0 text-xs w-full outline-none"
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
      <input
        ref={inputRef}
        type="text"
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
        className="bg-muted border border-primary rounded px-1 py-0 text-xs flex-1 outline-none"
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
}) {
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

    if (dragOver === "inside" && isFolder) {
      await onReorder(draggedId, node.id, 0);
      if (!isExpanded) toggleFolder(node.id);
    } else if (dragOver === "above") {
      // 같은 부모, 현재 노드 위로
      await onReorder(draggedId, null, -1); // API에서 처리
    } else if (dragOver === "below") {
      await onReorder(draggedId, null, -1);
    }
    setDragOver(null);
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskSidebar({
  groups,
  prds,
  docTree,
  filter,
  onFilterChange,
  onDocCreate,
  onDocDelete,
  onDocRename,
  onDocReorder,
  requestItems = [],
  onStopTask,
  currentPath = "/",
}: TaskSidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Auto-expand all folders
    const ids = new Set<string>();
    function walk(nodes: DocNode[]) {
      for (const n of nodes) {
        if (n.type === "folder") {
          ids.add(n.id);
          walk(n.children);
        }
      }
    }
    walk(docTree);
    return ids;
  });
  const [newRootItemType, setNewRootItemType] = useState<"doc" | "folder" | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
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

  // Show only the 10 most recently updated tasks in the sidebar
  const recentItems = [...requestItems]
    .sort((a, b) => (b.updated ?? b.created).localeCompare(a.updated ?? a.created))
    .slice(0, 10);

  // Group recent items by status for sidebar display
  const inProgressTasks = recentItems.filter((r) => r.status === "in_progress");
  const pendingTasks = recentItems.filter((r) => r.status === "pending" || r.status === "reviewing");
  const doneTasks = recentItems.filter((r) => r.status === "done");
  const rejectedTasks = recentItems.filter((r) => r.status === "rejected");

  // Display task ID as TASK-XXX in UI
  const displayTaskId = (id: string) => id;

  return (
    <div className="ide-sidebar flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-3 h-10 border-b border-sidebar-border shrink-0">
        <Link href="/" className="text-sm font-semibold text-sidebar-foreground no-underline hover:text-primary transition-colors">
          Home
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">

        {/* ── Docs (문서 트리) ── */}
        <div className="mb-2">
          <div className="px-2 mb-1 flex items-center justify-between">
            <Link href="/docs" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors no-underline cursor-pointer">
              Docs
            </Link>
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
          </div>

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
            />
          ))}

          {docTree.length === 0 && !newRootItemType && (
            <div className="px-2 py-2 text-[11px] text-muted-foreground">
              No documents yet
            </div>
          )}
        </div>

        {/* ── Tasks (merged from Requests) ── */}
        <div className="mb-2">
          <div className="px-2 mb-1 flex items-center justify-between">
            <Link href="/tasks" className={cn("text-xs font-semibold uppercase tracking-wider text-muted-foreground no-underline hover:text-foreground transition-colors", currentPath === "/tasks" && "text-foreground")}>
              Tasks
            </Link>
            <span className="text-[10px] text-muted-foreground">{requestItems.length}</span>
          </div>

          {/* In Progress tasks */}
          {inProgressTasks.map((task) => {
            const taskDisplayId = displayTaskId(task.id);
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
                {onStopTask && (
                  <button
                    type="button"
                    title="중지 → Pending"
                    onClick={(e) => { e.stopPropagation(); onStopTask(task.id); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Square className="h-2.5 w-2.5" />
                  </button>
                )}
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

          {/* Pending / Reviewing tasks */}
          {pendingTasks.map((task) => {
            const taskDisplayId = displayTaskId(task.id);
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
            const taskDisplayId = displayTaskId(task.id);
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
                const taskDisplayId = displayTaskId(task.id);
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
      </div>

      {/* Bottom: Cost + Terminal + Settings */}
      <div className="border-t border-sidebar-border px-2 py-2">
        <Link href="/cost" className={cn("tree-item text-sidebar-foreground no-underline", currentPath === "/cost" && "active")}>
          <DollarSign className="h-3.5 w-3.5" />
          <span>Cost</span>
        </Link>
        <Link href="/monitor" className={cn("tree-item text-sidebar-foreground no-underline", currentPath === "/monitor" && "active")}>
          <Activity className="h-3.5 w-3.5" />
          <span>Monitor</span>
        </Link>
        <Link href="/terminal" className={cn("tree-item text-sidebar-foreground no-underline", currentPath === "/terminal" && "active")}>
          <SquareTerminal className="h-3.5 w-3.5" />
          <span>Terminal</span>
        </Link>
        <Link href="/settings" className={cn("tree-item text-sidebar-foreground no-underline", currentPath === "/settings" && "active")}>
          <Settings className="h-3.5 w-3.5" />
          <span>Settings</span>
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
