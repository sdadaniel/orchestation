"use client";

import { useState, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequests, type RequestItem } from "@/hooks/useRequests";
import { cn } from "@/lib/utils";
import { Plus, Layers, Search, ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, Link2 } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import AutoImproveControl from "@/components/AutoImproveControl";
import DAGCanvas from "@/components/DAGCanvas";
import { RequestCard } from "@/components/RequestCard";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { PRIORITY_COLORS, STATUS_DOT, STATUS_ORDER, TAB_STACK, TAB_ALL, TABS, TAB_LABEL } from "./constants";

function ChainGroup({ items, onUpdate, onDelete, onReorder, isFirst, isLast }: { items: RequestItem[]; onUpdate: (id: string, updates: Partial<Pick<RequestItem, "status" | "title" | "content" | "priority">>) => Promise<void>; onDelete: (id: string) => Promise<void>; onReorder?: (id: string, direction: "up" | "down") => Promise<void>; isFirst?: boolean; isLast?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const first = items[0];
  return (
    <div className="board-card">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <ChevronRight className={cn("h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-200", expanded && "rotate-90")} />
        {first.status === "in_progress" ? <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" /> : <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[first.status])} />}
        <Link2 className="h-3 w-3 text-yellow-500 shrink-0" />
        <span className="font-mono text-[11px] text-muted-foreground shrink-0">{first.id}</span>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0", PRIORITY_COLORS[first.priority])}>{first.priority}</span>
        <span className="text-sm flex-1 truncate text-left">{first.title} <span className="text-muted-foreground text-xs">외 {items.length - 1}건</span></span>
        <span className="text-[10px] text-muted-foreground shrink-0">{items.reduce((latest, r) => { const d = r.updated || r.created; return d > latest ? d : latest; }, first.updated || first.created)}</span>
        {onReorder && (
          <div className="flex flex-col shrink-0" onClick={(e) => e.stopPropagation()}>
            <button type="button" disabled={isFirst} onClick={() => onReorder(first.id, "up")} className={cn("p-0.5 rounded transition-colors", isFirst ? "text-muted-foreground/30 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted")}><ChevronUp className="h-3 w-3" /></button>
            <button type="button" disabled={isLast} onClick={() => onReorder(first.id, "down")} className={cn("p-0.5 rounded transition-colors", isLast ? "text-muted-foreground/30 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted")}><ChevronDown className="h-3 w-3" /></button>
          </div>
        )}
      </div>
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-200 ease-out"
        style={{ maxHeight: expanded ? "none" : 0, opacity: expanded ? 1 : 0 }}
      >
        <div className="mt-2 pt-2 border-t border-border space-y-1">
          {items.map((req) => (
            <RequestCard key={req.id} req={req} onUpdate={onUpdate} onDelete={onDelete} isFirst isLast />
          ))}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

type SortKey = "newest" | "oldest" | "priority" | "id";

function TasksPageInner() {
  const { requests, isLoading, error, updateRequest, deleteRequest, reorderRequest } = useRequests();
  const { groups } = useTasks();
  const allWaterfallTasks = groups.flatMap((g) => g.tasks);
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || TAB_STACK;
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const setActiveTab = (tab: string) => { router.push(`/tasks?tab=${tab}`, { scroll: false }); setPage(1); };

  // Reset page when filters change
  const resetPage = () => setPage(1);

  const filtered = useMemo(() => {
    let result = requests;
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q));
    }
    // Priority
    if (priorityFilter !== "all" && activeTab !== TAB_STACK) {
      result = result.filter((r) => r.priority === priorityFilter);
    }
    // Date range
    if (dateFrom) {
      result = result.filter((r) => (r.updated || r.created) >= dateFrom);
    }
    if (dateTo) {
      // dateTo is inclusive, so compare with dateTo + "T23:59:59"
      const toEnd = dateTo + "T23:59:59";
      result = result.filter((r) => (r.updated || r.created) <= toEnd);
    }
    return result;
  }, [requests, searchQuery, priorityFilter, activeTab, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    switch (sortKey) {
      case "newest":
        return items.sort((a, b) => (b.updated || b.created).localeCompare(a.updated || a.created));
      case "oldest":
        return items.sort((a, b) => (a.updated || a.created).localeCompare(b.updated || b.created));
      case "priority": {
        const w = (p: string) => p === "high" ? 0 : p === "medium" ? 1 : p === "low" ? 2 : 3;
        return items.sort((a, b) => w(a.priority) - w(b.priority) || (b.updated || b.created).localeCompare(a.updated || a.created));
      }
      case "id":
        return items.sort((a, b) => a.id.localeCompare(b.id));
      default:
        return items;
    }
  }, [filtered, sortKey]);

  const grouped = useMemo(() => {
    const byStatus = (status: string) => sorted.filter((r) => r.status === status);
    return {
      stopped: byStatus("stopped"),
      pending: byStatus("pending"),
      reviewing: byStatus("reviewing"),
      in_progress: byStatus("in_progress"),
      rejected: byStatus("rejected"),
      done: byStatus("done"),
    } as Record<string, RequestItem[]>;
  }, [sorted]);

  // Flat list for pagination (non-ALL tabs)
  const flatItems = useMemo(() => {
    if (activeTab === TAB_STACK) return [];
    if (activeTab === TAB_ALL) {
      return STATUS_ORDER.flatMap((s) => grouped[s] ?? []);
    }
    return grouped[activeTab] ?? [];
  }, [activeTab, grouped]);

  const totalItems = flatItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = flatItems.slice((safePage - 1) * pageSize, safePage * pageSize);

  // 의존 체인 그룹핑: 연결된 태스크들을 하나의 그룹으로 묶음
  const depChainGroups = useMemo(() => {
    const taskMap = new Map(allWaterfallTasks.map((t) => [t.id, t]));
    const itemIds = new Set(paginatedItems.map((r) => r.id));

    // Union-Find로 연결된 태스크 그룹화
    const parent = new Map<string, string>();
    const find = (id: string): string => {
      if (!parent.has(id)) parent.set(id, id);
      if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
      return parent.get(id)!;
    };
    const union = (a: string, b: string) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    for (const item of paginatedItems) {
      const wt = taskMap.get(item.id);
      if (!wt) continue;
      for (const dep of wt.depends_on) {
        if (itemIds.has(dep)) union(item.id, dep);
      }
    }

    // 그룹별로 모으기 (원래 순서 유지)
    const groups: { items: RequestItem[]; isChain: boolean }[] = [];
    const seen = new Set<string>();
    for (const item of paginatedItems) {
      const root = find(item.id);
      if (seen.has(root)) continue;
      seen.add(root);
      const members = paginatedItems.filter((r) => find(r.id) === root);
      // 체인 내 토폴로지 정렬 (의존 대상이 먼저)
      if (members.length > 1) {
        const sorted: RequestItem[] = [];
        const memberIds = new Set(members.map((m) => m.id));
        const visited = new Set<string>();
        const visit = (id: string) => {
          if (visited.has(id) || !memberIds.has(id)) return;
          visited.add(id);
          const wt = taskMap.get(id);
          if (wt) for (const dep of wt.depends_on) visit(dep);
          sorted.push(members.find((m) => m.id === id)!);
        };
        for (const m of members) visit(m.id);
        groups.push({ items: sorted, isChain: true });
      } else {
        groups.push({ items: members, isChain: false });
      }
    }
    return groups;
  }, [paginatedItems, allWaterfallTasks]);

  const showFilters = activeTab !== TAB_STACK;
  const hasActiveFilters = priorityFilter !== "all" || dateFrom || dateTo;

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading tasks...</div>;
  if (error) return <div className="p-4 text-sm text-red-500">{error}</div>;

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4"><h1 className="text-lg font-semibold">Tasks</h1><AutoImproveControl /></div>
        <button type="button" onClick={() => router.push("/tasks/new")} className="filter-pill active flex items-center gap-1"><Plus className="h-3 w-3" />New Task</button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => {
          const count = tab === TAB_STACK ? requests.length : tab === TAB_ALL ? filtered.length : grouped[tab]?.length ?? 0;
          return (
            <span key={tab} className="flex items-center">
              <button type="button" onClick={() => setActiveTab(tab)} className={cn("flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium border-b-2 transition-colors -mb-px whitespace-nowrap", activeTab === tab ? (tab === TAB_STACK ? "border-violet-400 text-violet-400" : "border-primary text-primary") : "border-transparent text-muted-foreground hover:text-foreground")}>
                {tab === TAB_STACK && <Layers className="h-3 w-3 shrink-0" />}
                {tab !== TAB_ALL && tab !== TAB_STACK && <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[tab])} />}
                {TAB_LABEL[tab]}
                <span className="text-[10px] text-muted-foreground">({count})</span>
              </button>
              {tab === TAB_STACK && <span className="h-4 w-px bg-border mx-1" />}
            </span>
          );
        })}
      </div>

      {/* Search */}
      {showFilters && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); resetPage(); }} placeholder="ID, 제목, 내용으로 검색..." className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50" />
        </div>
      )}

      {/* Filters Row */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Priority */}
          <div className="flex items-center gap-1">
            {(["all", "high", "medium", "low"] as const).map((p) => (
              <button key={p} type="button" onClick={() => { setPriorityFilter(p); resetPage(); }} className={cn("filter-pill text-[11px]", priorityFilter === p && "active", priorityFilter === p && p !== "all" && PRIORITY_COLORS[p])}>{p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}</button>
            ))}
          </div>

          <span className="h-4 w-px bg-border" />

          {/* Sort */}
          <div className="flex items-center gap-1">
            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
            <Select size="inline" value={sortKey} onChange={(e) => { setSortKey(e.target.value as SortKey); resetPage(); }}>
              <option value="newest">최신순</option>
              <option value="oldest">오래된순</option>
              <option value="priority">우선순위순</option>
              <option value="id">ID순</option>
            </Select>
          </div>

          <span className="h-4 w-px bg-border" />

          {/* Date Range */}
          <div className="flex items-center gap-1.5">
            <DatePicker
              value={dateFrom}
              onChange={(v) => { setDateFrom(v); resetPage(); }}
              placeholder="시작일"
            />
            <span className="text-[10px] text-muted-foreground">~</span>
            <DatePicker
              value={dateTo}
              onChange={(v) => { setDateTo(v); resetPage(); }}
              placeholder="종료일"
            />
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { setPriorityFilter("all"); setDateFrom(""); setDateTo(""); resetPage(); }}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              초기화
            </button>
          )}
        </div>
      )}

      {/* Search only for Graph — 제거됨 */}
      {false && activeTab === TAB_STACK && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ID, 제목, 내용으로 검색..." className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50" />
        </div>
      )}

      {/* Result count */}
      {showFilters && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {totalItems}개 결과
            {hasActiveFilters && ` (전체 ${requests.length}개 중)`}
          </span>
        </div>
      )}

      {/* Views */}
      {activeTab === TAB_STACK && (() => {
        const inProgressTasks = requests.filter((r) => r.status === "in_progress");
        // scope를 태스크별로 그룹핑
        const taskScopes = inProgressTasks
          .filter((r) => (r.scope ?? []).length > 0)
          .map((r) => {
            const scopes = r.scope ?? [];
            // 공통 prefix 추출
            const getPrefix = (s: string) => {
              const parts = s.replace(/\/\*\*$/, "").split("/");
              return parts.length > 2 ? parts.slice(0, 3).join("/") : parts.join("/");
            };
            const grouped = new Map<string, string[]>();
            for (const s of scopes) {
              const prefix = getPrefix(s);
              if (!grouped.has(prefix)) grouped.set(prefix, []);
              grouped.get(prefix)!.push(s);
            }
            return { taskId: r.id, title: r.title, groups: grouped };
          });
        return (
          <>
            {taskScopes.length > 0 && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 mb-2">점유 중인 Scope</div>
                <div className="space-y-2">
                  {taskScopes.map((t) => (
                    <div key={t.taskId}>
                      <div className="text-[10px] font-medium text-blue-300 mb-1">{t.taskId} <span className="text-blue-500/50 font-normal">{t.title}</span></div>
                      <div className="flex flex-wrap gap-1">
                        {[...t.groups.entries()].map(([prefix, paths]) => (
                          <span key={prefix} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300/80 border border-blue-500/15">
                            {prefix}{paths.length > 1 ? ` (${paths.length})` : paths[0] !== prefix ? `/${paths[0].slice(prefix.length + 1)}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DAGCanvas requests={filtered} tasks={allWaterfallTasks} onClickItem={(req) => router.push(`/tasks/${req.id}`)} />
          </>
        );
      })()}

      {/* List View */}
      {activeTab !== TAB_STACK && (
        <div className="space-y-1">
          {depChainGroups.map((group, gi) =>
            group.isChain ? (
              <ChainGroup key={group.items[0].id} items={group.items} onUpdate={updateRequest} onDelete={deleteRequest} onReorder={group.items[0].status === "pending" ? reorderRequest : undefined} isFirst={gi === 0} isLast={gi === depChainGroups.length - 1} />
            ) : (
              group.items.map((req, i) => (
                <RequestCard key={req.id} req={req} onUpdate={updateRequest} onDelete={deleteRequest} onReorder={req.status === "pending" ? reorderRequest : undefined} isFirst={gi === 0 && i === 0} isLast={gi === depChainGroups.length - 1 && i === group.items.length - 1} />
              ))
            ),
          )}
        </div>
      )}

      {activeTab !== TAB_STACK && totalItems === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">{requests.length === 0 ? "No tasks yet." : "해당 조건의 태스크가 없습니다."}</p>
        </div>
      )}

      {/* Pagination */}
      {showFilters && totalItems > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">페이지당</span>
            <Select size="inline" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}개</option>)}
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`dots-${i}`} className="px-1 text-[11px] text-muted-foreground">...</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p as number)}
                    className={cn(
                      "min-w-[28px] h-7 rounded text-[11px] font-medium transition-colors",
                      safePage === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {p}
                  </button>
                ),
              )}

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <span className="text-[11px] text-muted-foreground">
            {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, totalItems)} / {totalItems}
          </span>
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}><TasksPageInner /></Suspense>;
}
