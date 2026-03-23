"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTasks } from "@/hooks/useTasks";
import { usePrds } from "@/hooks/usePrds";
import { useDocTree } from "@/hooks/useDocTree";
import { TaskSidebar, type SidebarFilter } from "@/components/sidebar";
import { TaskRow } from "@/components/TaskRow";
import { RightPanel } from "@/components/RightPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Search, ArrowUpDown, SearchIcon } from "lucide-react";
import { ChatBot } from "@/components/ChatBot";
import { STATUS_STYLES, type TaskStatus } from "../../lib/constants";
import type { WaterfallTask } from "@/types/waterfall";

/* ── Sort ── */
type SortKey = "id" | "title" | "priority" | "status" | "role";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<string, number> = { in_progress: 0, in_review: 1, backlog: 2, done: 3 };

function compareTasks(a: WaterfallTask, b: WaterfallTask, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  switch (key) {
    case "id": cmp = a.id.localeCompare(b.id); break;
    case "title": cmp = a.title.localeCompare(b.title); break;
    case "priority": cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99); break;
    case "status": cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99); break;
    case "role": cmp = a.role.localeCompare(b.role); break;
  }
  return dir === "asc" ? cmp : -cmp;
}

const ALL_STATUSES: TaskStatus[] = ["backlog", "in_progress", "in_review", "done"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { groups, isLoading, error } = useTasks();
  const { prds } = usePrds();
  const { tree: docTree, createDoc, updateDoc, deleteDoc, reorderDoc } = useDocTree();

  const [filter, setFilter] = useState<SidebarFilter>({ type: "all" });
  const [selectedTask, setSelectedTask] = useState<WaterfallTask | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const listRef = useRef<HTMLDivElement>(null);

  const isTaskView = pathname === "/" && (filter.type === "all" || filter.type === "status" || filter.type === "sprint");
  const isSubPage = pathname !== "/" && !pathname.startsWith("/docs/");

  // Flatten all tasks
  const allTasks = useMemo(() => groups.flatMap((g) => g.tasks), [groups]);

  // Apply sidebar filter
  const sidebarFiltered = useMemo(() => {
    switch (filter.type) {
      case "all": return allTasks;
      case "prd": {
        const prd = prds.find((p) => p.id === filter.prdId);
        if (!prd) return allTasks;
        const prdSprintIds = new Set(prd.sprints);
        return allTasks.filter((t) => groups.some((g) => prdSprintIds.has(g.sprint.id) && g.tasks.some((gt) => gt.id === t.id)));
      }
      case "sprint":
        return allTasks.filter((t) => {
          const group = groups.find((g) => g.sprint.id === filter.sprintId);
          return group?.tasks.some((gt) => gt.id === t.id);
        });
      case "status": return allTasks.filter((t) => t.status === filter.status);
      default: return allTasks;
    }
  }, [allTasks, filter, groups, prds]);

  // Apply search + status + sort
  const filteredTasks = useMemo(() => {
    let result = sidebarFiltered;
    if (statusFilter) result = result.filter((t) => t.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q) || t.role.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => compareTasks(a, b, sortKey, sortDir));
  }, [sidebarFiltered, statusFilter, searchQuery, sortKey, sortDir]);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }, [sortKey]);

  const handleTaskClick = useCallback((task: WaterfallTask) => {
    setSelectedTask((prev) => (prev?.id === task.id ? null : task));
  }, []);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setSelectedTask(null);
  }, []);

  const handleFilterChange = useCallback((f: SidebarFilter) => {
    setFilter(f);
    setSelectedTask(null);
  }, []);

  // Doc tree handlers
  const handleDocCreate = useCallback(async (title: string, type: "doc" | "folder", parentId?: string | null) => {
    await createDoc(title, type, parentId);
  }, [createDoc]);

  const handleDocDelete = useCallback(async (id: string) => {
    await deleteDoc(id);
  }, [deleteDoc]);

  const handleDocRename = useCallback(async (id: string, title: string) => {
    await updateDoc(id, { title });
  }, [updateDoc]);

  const handleDocReorder = useCallback(async (nodeId: string, targetParentId: string | null, position: number) => {
    await reorderDoc(nodeId, targetParentId, position);
  }, [reorderDoc]);

  // Keyboard navigation
  useEffect(() => {
    if (!isTaskView) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = selectedTask ? filteredTasks.findIndex((t) => t.id === selectedTask.id) : -1;
        const next = e.key === "ArrowDown" ? (idx < filteredTasks.length - 1 ? idx + 1 : 0) : (idx > 0 ? idx - 1 : filteredTasks.length - 1);
        if (filteredTasks[next]) setSelectedTask(filteredTasks[next]);
      }
      if (e.key === "Escape") setSelectedTask(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredTasks, selectedTask, isTaskView]);

  useEffect(() => {
    if (filter.type === "status") setStatusFilter(null);
  }, [filter]);

  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="ide-sidebar p-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-5 w-full mb-2 rounded" />)}
        </div>
        <div className="flex-1 p-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-7 w-full mb-1 rounded" />)}
        </div>
      </div>
    );
  }

  const showRightPanel = isTaskView && selectedTask !== null;

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <button type="button" className="col-header" onClick={() => handleSort(sortKeyName)}>
      {label}
      {sortKey === sortKeyName && <ArrowUpDown className="h-2.5 w-2.5" />}
    </button>
  );

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <TaskSidebar
        groups={groups}
        prds={prds}
        docTree={docTree}
        filter={filter}
        onFilterChange={handleFilterChange}
        onDocCreate={handleDocCreate}
        onDocDelete={handleDocDelete}
        onDocRename={handleDocRename}
        onDocReorder={handleDocReorder}
        currentPath={pathname}
      />

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Global header */}
        <div className="global-header">
          <div className="global-search">
            <SearchIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input type="text" placeholder="검색" />
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {pathname === "/" && !isTaskView ? (
            /* 홈: 빈 화면 */
            <div className="flex-1" />
          ) : isTaskView ? (
        <>
          <div className="ide-main flex flex-col">
            {/* Filter bar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
              <div className="flex items-center gap-1.5 bg-muted rounded px-2 py-1 flex-1 max-w-xs">
                <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs w-full placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className={cn("filter-pill", !statusFilter && "active")} onClick={() => setStatusFilter(null)}>All</button>
                {ALL_STATUSES.map((status) => {
                  const style = STATUS_STYLES[status];
                  return (
                    <button key={status} type="button" className={cn("filter-pill", statusFilter === status && "active")} onClick={() => setStatusFilter(statusFilter === status ? null : status)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", style.dot)} />
                      {style.label}
                    </button>
                  );
                })}
              </div>
              <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{filteredTasks.length} tasks</span>
            </div>

            {/* Column headers */}
            <div className="flex items-center gap-2 px-3 h-6 border-b border-border shrink-0 bg-muted/30">
              <span className="w-2" />
              <span className="w-[72px] shrink-0"><SortHeader label="ID" sortKeyName="id" /></span>
              <span className="flex-1"><SortHeader label="Title" sortKeyName="title" /></span>
              <span className="w-16 shrink-0"><SortHeader label="Priority" sortKeyName="priority" /></span>
              <span className="w-16 shrink-0 text-right"><SortHeader label="Role" sortKeyName="role" /></span>
              <span className="w-10 shrink-0" />
            </div>

            {/* Task rows */}
            <div ref={listRef} className="flex-1 overflow-y-auto" onClick={handleBackgroundClick}>
              {filteredTasks.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">No matching tasks</div>
              ) : (
                filteredTasks.map((task) => (
                  <TaskRow key={task.id} task={task} isSelected={selectedTask?.id === task.id} onClick={handleTaskClick} />
                ))
              )}
            </div>
          </div>

          {/* Right panel */}
          {showRightPanel && (
            <RightPanel task={selectedTask} prd={null} />
          )}
        </>
      ) : (
        /* Other pages */
        <div className="flex-1 overflow-auto bg-background p-4">
          <div className="content-container">
            {children}
          </div>
        </div>
        )}
        </div>
      </div>

      {/* ChatBot */}
      <ChatBot />
    </div>
  );
}
