"use client";

import { useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequests, type RequestItem } from "@/hooks/useRequests";
import { cn } from "@/lib/utils";
import { Plus, Layers, Search } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import AutoImproveControl from "@/components/AutoImproveControl";
import DAGCanvas from "@/components/DAGCanvas";
import { RequestCard } from "@/components/RequestCard";
import { PRIORITY_COLORS, STATUS_DOT, STATUS_LABEL, STATUS_ORDER, TAB_STACK, TAB_ALL, TABS, TAB_LABEL } from "./constants";

function TasksPageInner() {
  const { requests, isLoading, error, updateRequest, deleteRequest, reorderRequest } = useRequests();
  const { groups } = useTasks();
  const allWaterfallTasks = groups.flatMap((g) => g.tasks);
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || TAB_STACK;
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const setActiveTab = (tab: string) => { router.push(`/tasks?tab=${tab}`, { scroll: false }); };

  const filtered = useMemo(() => {
    let result = requests;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q));
    }
    if (priorityFilter !== "all" && activeTab !== TAB_STACK && activeTab !== TAB_STACK) {
      result = result.filter((r) => r.priority === priorityFilter);
    }
    return result;
  }, [requests, searchQuery, priorityFilter, activeTab]);

  const grouped = useMemo(() => {
    const priWeight = (p: string) => p === "high" ? 0 : p === "medium" ? 1 : p === "low" ? 2 : 3;
    const sortByPriority = (items: RequestItem[]) => [...items].sort((a, b) => priWeight(a.priority) - priWeight(b.priority) || (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id));
    return { stopped: sortByPriority(filtered.filter((r) => r.status === "stopped")), pending: sortByPriority(filtered.filter((r) => r.status === "pending")), reviewing: sortByPriority(filtered.filter((r) => r.status === "reviewing")), in_progress: sortByPriority(filtered.filter((r) => r.status === "in_progress")), rejected: sortByPriority(filtered.filter((r) => r.status === "rejected")), done: sortByPriority(filtered.filter((r) => r.status === "done")) } as Record<string, RequestItem[]>;
  }, [filtered]);

  const filteredStatuses = activeTab === TAB_ALL ? STATUS_ORDER.filter((s) => grouped[s].length > 0) : [activeTab];
  const showPriorityFilter = activeTab !== TAB_STACK;

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading tasks...</div>;
  if (error) return <div className="p-4 text-sm text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4"><h1 className="text-lg font-semibold">Tasks</h1><AutoImproveControl /></div>
        <button type="button" onClick={() => router.push("/tasks/new")} className="filter-pill active flex items-center gap-1"><Plus className="h-3 w-3" />New Task</button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => {
          const count = tab === TAB_ALL || tab === TAB_STACK || tab === TAB_STACK ? requests.length : grouped[tab]?.length ?? 0;
          return (
            <span key={tab} className="flex items-center">
              <button type="button" onClick={() => setActiveTab(tab)} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px", activeTab === tab ? (tab === TAB_STACK || tab === TAB_STACK ? "border-violet-400 text-violet-400" : "border-primary text-primary") : "border-transparent text-muted-foreground hover:text-foreground")}>
                {tab === TAB_STACK && <Layers className="h-3 w-3 shrink-0" />}
                {tab !== TAB_ALL && tab !== TAB_STACK && tab !== TAB_STACK && <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[tab])} />}
                {TAB_LABEL[tab]}
                <span className="text-[10px] text-muted-foreground">({count})</span>
              </button>
              {tab === TAB_STACK && <span className="h-4 w-px bg-border mx-1" />}
            </span>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ID, 제목, 내용으로 검색..." className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50" />
      </div>

      {/* Priority Filter */}
      {showPriorityFilter && (
        <div className="flex items-center gap-1">
          {(["all", "high", "medium", "low"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setPriorityFilter(p)} className={cn("filter-pill text-[11px]", priorityFilter === p && (p === "all" ? "active" : PRIORITY_COLORS[p]))}>{p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}</button>
          ))}
        </div>
      )}

      {/* Views */}
      {activeTab === TAB_STACK && <DAGCanvas requests={filtered} tasks={allWaterfallTasks} onClickItem={(req) => router.push(`/tasks/${req.id}`)} />}

      {/* List View */}
      {activeTab !== TAB_STACK && activeTab !== TAB_STACK && filteredStatuses.map((status) => {
        const items = grouped[status];
        if (!items || items.length === 0) return null;
        return (
          <div key={status}>
            {activeTab === TAB_ALL && (
              <div className="flex items-center gap-2 mb-2">
                {status === "in_progress" ? <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" /> : <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[status])} />}
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{STATUS_LABEL[status]}</span>
                <span className="text-[10px] text-muted-foreground">({items.length})</span>
              </div>
            )}
            <div className="space-y-1">
              {items.map((req, i) => <RequestCard key={req.id} req={req} onUpdate={updateRequest} onDelete={deleteRequest} onReorder={req.status === "pending" ? reorderRequest : undefined} isFirst={i === 0} isLast={i === items.length - 1} />)}
            </div>
          </div>
        );
      })}

      {activeTab !== TAB_STACK && activeTab !== TAB_STACK && requests.length === 0 && (
        <div className="text-center py-12 text-muted-foreground"><p className="text-sm">No tasks yet.</p></div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}><TasksPageInner /></Suspense>;
}
