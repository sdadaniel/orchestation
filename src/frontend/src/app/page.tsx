"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { AlertCircle, Search, ArrowUpDown } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { usePrds } from "@/hooks/usePrds";
import { TaskSidebar, type SidebarFilter } from "@/components/sidebar";
import { TaskRow } from "@/components/TaskRow";
import { RightPanel } from "@/components/RightPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { STATUS_STYLES, type TaskStatus } from "../../lib/constants";
import type { WaterfallTask } from "@/types/waterfall";

/* ── Loading / Error states ── */

function LoadingSkeleton() {
  return (
    <div className="ide-layout">
      <div className="ide-sidebar p-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-5 w-full mb-2 rounded" />
        ))}
      </div>
      <div className="ide-main p-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-7 w-full mb-1 rounded" />
        ))}
      </div>
      <div className="ide-right p-3">
        <Skeleton className="h-6 w-full mb-3 rounded" />
        <Skeleton className="h-4 w-3/4 mb-2 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-4 w-4" />
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}

/* ── Sort helpers ── */

type SortKey = "id" | "title" | "priority" | "status" | "role";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  in_review: 1,
  backlog: 2,
  done: 3,
};

function compareTasks(a: WaterfallTask, b: WaterfallTask, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  switch (key) {
    case "id":
      cmp = a.id.localeCompare(b.id);
      break;
    case "title":
      cmp = a.title.localeCompare(b.title);
      break;
    case "priority":
      cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
      break;
    case "status":
      cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      break;
    case "role":
      cmp = a.role.localeCompare(b.role);
      break;
  }
  return dir === "asc" ? cmp : -cmp;
}

/* ── Filter pills ── */

const ALL_STATUSES: TaskStatus[] = ["backlog", "in_progress", "in_review", "done"];

/* ── Main page component ── */

export default function TaskPage() {
  const { groups, isLoading, error } = useTasks();
  const { prds } = usePrds();

  // State
  const [filter, setFilter] = useState<SidebarFilter>({ type: "all" });
  const [selectedTask, setSelectedTask] = useState<WaterfallTask | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const listRef = useRef<HTMLDivElement>(null);

  // Flatten all tasks
  const allTasks = useMemo(() => {
    return groups.flatMap((g) => g.tasks);
  }, [groups]);

  // Apply sidebar filter
  const sidebarFiltered = useMemo(() => {
    switch (filter.type) {
      case "all":
        return allTasks;
      case "prd": {
        const prd = prds.find((p) => p.id === filter.prdId);
        if (!prd) return allTasks;
        const prdSprintIds = new Set(prd.sprints);
        return allTasks.filter((t) => {
          return groups.some((g) => prdSprintIds.has(g.sprint.id) && g.tasks.some((gt) => gt.id === t.id));
        });
      }
      case "sprint":
        return allTasks.filter((t) => {
          const group = groups.find((g) => g.sprint.id === filter.sprintId);
          return group?.tasks.some((gt) => gt.id === t.id);
        });
      case "status":
        return allTasks.filter((t) => t.status === filter.status);
      default:
        return allTasks;
    }
  }, [allTasks, filter, groups, prds]);

  // Apply search + status filter + sort
  const filteredTasks = useMemo(() => {
    let result = sidebarFiltered;

    // Status pill filter
    if (statusFilter) {
      result = result.filter((t) => t.status === statusFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.role.toLowerCase().includes(q),
      );
    }

    // Sort
    result = [...result].sort((a, b) => compareTasks(a, b, sortKey, sortDir));

    return result;
  }, [sidebarFiltered, statusFilter, searchQuery, sortKey, sortDir]);

  // Toggle sort
  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIndex = selectedTask
          ? filteredTasks.findIndex((t) => t.id === selectedTask.id)
          : -1;

        let nextIndex: number;
        if (e.key === "ArrowDown") {
          nextIndex = currentIndex < filteredTasks.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : filteredTasks.length - 1;
        }

        if (filteredTasks[nextIndex]) {
          setSelectedTask(filteredTasks[nextIndex]);
        }
      }

      if (e.key === "Escape") {
        setSelectedTask(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredTasks, selectedTask]);

  // When sidebar filter changes and we have a status filter from sidebar, sync it
  useEffect(() => {
    if (filter.type === "status") {
      setStatusFilter(null); // sidebar already filters by status
    }
  }, [filter]);

  /* ── Render ── */

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;

  if (groups.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-xs text-muted-foreground">No tasks registered.</p>
      </div>
    );
  }

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <button
      type="button"
      className="col-header"
      onClick={() => handleSort(sortKeyName)}
    >
      {label}
      {sortKey === sortKeyName && (
        <ArrowUpDown className="h-2.5 w-2.5" />
      )}
    </button>
  );

  return (
    <div className={cn("ide-layout", !selectedTask && "no-right-panel")}>
      {/* Left: Sidebar */}
      <TaskSidebar groups={groups} prds={prds} filter={filter} onFilterChange={setFilter} />

      {/* Middle: Task list */}
      <div className="ide-main flex flex-col">
        {/* Filter bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
          {/* Search */}
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

          {/* Status pills */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={cn("filter-pill", !statusFilter && "active")}
              onClick={() => setStatusFilter(null)}
            >
              All
            </button>
            {ALL_STATUSES.map((status) => {
              const style = STATUS_STYLES[status];
              return (
                <button
                  key={status}
                  type="button"
                  className={cn("filter-pill", statusFilter === status && "active")}
                  onClick={() => setStatusFilter(statusFilter === status ? null : status)}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", style.dot)} />
                  {style.label}
                </button>
              );
            })}
          </div>

          {/* Task count */}
          <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
            {filteredTasks.length} tasks
          </span>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-2 px-3 h-6 border-b border-border shrink-0 bg-muted/30">
          <span className="w-2" /> {/* dot spacer */}
          <span className="w-[72px] shrink-0">
            <SortHeader label="ID" sortKeyName="id" />
          </span>
          <span className="flex-1">
            <SortHeader label="Title" sortKeyName="title" />
          </span>
          <span className="w-16 shrink-0">
            <SortHeader label="Priority" sortKeyName="priority" />
          </span>
          <span className="w-16 shrink-0 text-right">
            <SortHeader label="Role" sortKeyName="role" />
          </span>
          <span className="w-10 shrink-0" /> {/* actions spacer */}
        </div>

        {/* Task rows */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {filteredTasks.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
              No matching tasks
            </div>
          ) : (
            filteredTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isSelected={selectedTask?.id === task.id}
                onClick={setSelectedTask}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: Detail panel (only when task selected) */}
      {selectedTask && <RightPanel task={selectedTask} />}
    </div>
  );
}
