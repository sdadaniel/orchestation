"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequests, type RequestItem } from "@/hooks/useRequests";
import { cn } from "@/lib/utils";
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, Square, Bot, Layers, ArrowDown, Clock, Loader2, GitBranch } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import type { WaterfallTask } from "@/types/waterfall";
import AutoImproveControl from "@/components/AutoImproveControl";

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-500 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  low: "bg-green-500/15 text-green-500 border-green-500/30",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-yellow-500",
  in_progress: "bg-blue-500",
  reviewing: "bg-orange-500",
  done: "bg-emerald-500",
  rejected: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  reviewing: "Reviewing",
  done: "Done",
  rejected: "Rejected",
};

const STATUS_ORDER = ["in_progress", "reviewing", "pending", "done", "rejected"];

const displayTaskId = (id: string) => id.replace(/^REQ-/, "TASK-");

function RequestCard({
  req,
  onUpdate,
  onDelete,
  onClick,
}: {
  req: RequestItem;
  onUpdate: (id: string, updates: Partial<Pick<RequestItem, "status" | "title" | "content" | "priority">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(req.title);
  const [editContent, setEditContent] = useState(req.content);
  const [editPriority, setEditPriority] = useState(req.priority);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiResultLoading, setAiResultLoading] = useState(false);
  const [cardTab, setCardTab] = useState<"content" | "ai-result">("content");
  const isReadOnly = req.status === "done";
  const showAiResult = req.status === "done" || req.status === "rejected";

  useEffect(() => {
    if (expanded && showAiResult && aiResult === null && !aiResultLoading) {
      setAiResultLoading(true);
      fetch(`/api/tasks/${req.id}/result`)
        .then((r) => r.json())
        .then((data) => setAiResult(data.result ?? ""))
        .catch(() => setAiResult(""))
        .finally(() => setAiResultLoading(false));
    }
  }, [expanded, showAiResult, aiResult, aiResultLoading, req.id]);

  const handleSave = async () => {
    await onUpdate(req.id, { title: editTitle, content: editContent, priority: editPriority });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (confirm(`${displayTaskId(req.id)} delete?`)) {
      await onDelete(req.id);
    }
  };

  return (
    <div className="board-card">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        {req.status === "in_progress" ? (
          <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[req.status])} />
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="font-mono text-[11px] text-muted-foreground shrink-0 hover:text-primary hover:underline bg-transparent border-none cursor-pointer p-0"
        >
          {displayTaskId(req.id)}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="text-sm flex-1 truncate text-left hover:text-primary bg-transparent border-none cursor-pointer p-0"
        >
          {req.title}
        </button>
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0",
          PRIORITY_COLORS[req.priority],
        )}>
          {req.priority}
        </span>
        {req.status === "in_progress" && (
          <button
            type="button"
            title="중지 → Pending"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(req.id, { status: "pending" });
            }}
            className="shrink-0 p-1 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors"
          >
            <Square className="h-3 w-3" />
          </button>
        )}
        <span className="text-[10px] text-muted-foreground shrink-0">{req.created}</span>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-border">
          {showAiResult && (
            <div className="flex items-center gap-1 mb-2 border-b border-border">
              <button
                type="button"
                onClick={() => setCardTab("content")}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium border-b-2 -mb-px transition-colors",
                  cardTab === "content"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                Content
              </button>
              <button
                type="button"
                onClick={() => setCardTab("ai-result")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border-b-2 -mb-px transition-colors",
                  cardTab === "ai-result"
                    ? "border-blue-400 text-blue-400"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Bot className="h-3 w-3" />
                AI Result
              </button>
            </div>
          )}

          {cardTab === "content" && (
            <div style={{ minHeight: showAiResult ? 150 : undefined }}>
              {editing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-muted border border-border rounded px-2 py-1 text-sm outline-none focus:border-primary"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    className="w-full bg-muted border border-border rounded px-2 py-1 text-sm outline-none focus:border-primary resize-y"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value as RequestItem["priority"])}
                      className="bg-muted border border-border rounded px-2 py-1 text-xs outline-none"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="filter-pill active text-xs"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false);
                        setEditTitle(req.title);
                        setEditContent(req.content);
                        setEditPriority(req.priority);
                      }}
                      className="filter-pill text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{req.content || "(No description)"}</p>
                  {!isReadOnly && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="filter-pill text-xs flex items-center gap-1"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="filter-pill text-xs flex items-center gap-1 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {cardTab === "ai-result" && (
            <div style={{ minHeight: 150 }}>
              {aiResultLoading ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : aiResult ? (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{aiResult}</p>
              ) : (
                <p className="text-xs text-muted-foreground">No result available.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TAB_STACK = "stack";
const TAB_ALL = "all";
const TABS = [TAB_STACK, TAB_ALL, ...STATUS_ORDER] as const;

const TAB_LABEL: Record<string, string> = {
  stack: "Stack",
  all: "All",
  ...STATUS_LABEL,
};

/* ── Stack View (Queue Pipeline) ─────────────────────────── */

/* ── Dependency Diagram ── */

function DependencyDiagram({ tasks }: { tasks: WaterfallTask[] }) {
  // 활성 태스크만 (backlog + in_progress + in_review)
  const activeTasks = tasks.filter((t) => t.status !== "done");
  if (activeTasks.length === 0) return null;

  // 의존 관계 맵
  const depMap = new Map<string, string[]>();
  const allIds = new Set(activeTasks.map((t) => t.id));
  for (const t of activeTasks) {
    const deps = t.depends_on.filter((d) => allIds.has(d));
    depMap.set(t.id, deps);
  }

  // 배치 분류: 의존성 없는 것 = 독립(병렬 가능), 있는 것 = 의존
  const independent = activeTasks.filter((t) => (depMap.get(t.id) || []).length === 0);
  const dependent = activeTasks.filter((t) => (depMap.get(t.id) || []).length > 0);

  const statusColor = (s: string) =>
    s === "in_progress" ? "border-blue-500 bg-blue-500/10" :
    s === "in_review" ? "border-orange-500 bg-orange-500/10" :
    "border-zinc-500 bg-zinc-500/10";

  const statusDot = (s: string) =>
    s === "in_progress" ? "bg-blue-500" :
    s === "in_review" ? "bg-orange-500" :
    "bg-zinc-400";

  return (
    <div className="rounded-lg border border-border bg-card p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Dependency Graph
        </span>
      </div>

      {/* 독립 태스크 (병렬 가능) */}
      {independent.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] text-muted-foreground mb-1.5">
            ⚡ 병렬 실행 가능 ({independent.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {independent.map((t) => (
              <div
                key={t.id}
                className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs", statusColor(t.status))}
              >
                {t.status === "in_progress" ? (
                  <span className="w-2 h-2 border border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <span className={cn("w-2 h-2 rounded-full shrink-0", statusDot(t.status))} />
                )}
                <span className="font-mono text-[10px] text-muted-foreground">{t.id}</span>
                <span className="truncate max-w-[120px]">{t.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 의존 태스크 (순차) */}
      {dependent.length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground mb-1.5">
            🔗 의존 관계 ({dependent.length})
          </div>
          <div className="space-y-2">
            {dependent.map((t) => {
              const deps = depMap.get(t.id) || [];
              return (
                <div key={t.id} className="flex items-center gap-2">
                  {/* 의존 대상 */}
                  <div className="flex items-center gap-1">
                    {deps.map((depId) => {
                      const depTask = tasks.find((x) => x.id === depId);
                      return (
                        <span
                          key={depId}
                          className={cn(
                            "rounded-md border px-1.5 py-0.5 text-[10px] font-mono",
                            depTask?.status === "done" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-zinc-500 bg-zinc-500/10 text-muted-foreground",
                          )}
                        >
                          {depTask?.status === "done" ? "✓" : "○"} {depId}
                        </span>
                      );
                    })}
                  </div>

                  {/* 화살표 */}
                  <span className="text-muted-foreground/40">→</span>

                  {/* 현재 태스크 */}
                  <div
                    className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs", statusColor(t.status))}
                  >
                    {t.status === "in_progress" ? (
                      <span className="w-2 h-2 border border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                      <span className={cn("w-2 h-2 rounded-full shrink-0", statusDot(t.status))} />
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground">{t.id}</span>
                    <span className="truncate max-w-[120px]">{t.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StackView({
  requests,
  tasks,
  onUpdate,
  onDelete,
  onClickItem,
}: {
  requests: RequestItem[];
  tasks: WaterfallTask[];
  onUpdate: (id: string, updates: Partial<Pick<RequestItem, "status" | "title" | "content" | "priority">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClickItem: (req: RequestItem) => void;
}) {
  const active = requests.filter((r) => r.status === "in_progress");
  const reviewing = requests.filter((r) => r.status === "reviewing");
  const queue = requests.filter((r) => r.status === "pending");

  const priorityWeight = { high: 0, medium: 1, low: 2 };
  const sortedQueue = [...queue].sort(
    (a, b) => (priorityWeight[a.priority] ?? 1) - (priorityWeight[b.priority] ?? 1),
  );

  const total = active.length + reviewing.length + sortedQueue.length;

  if (total === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Layers className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No active or queued tasks.</p>
        <p className="text-xs mt-1">Create a new task or change status to Pending to see it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Dependency Diagram ── */}
      <DependencyDiagram tasks={tasks} />

      {/* ── Processing Now ── */}
      {active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/15">
              <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Processing Now
            </span>
            <span className="text-[10px] text-muted-foreground">({active.length})</span>
          </div>
          <div className="space-y-1 pl-2 border-l-2 border-blue-500/40">
            {active.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onClick={() => onClickItem(req)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Connector ── */}
      {active.length > 0 && (reviewing.length > 0 || sortedQueue.length > 0) && (
        <div className="flex justify-center">
          <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
        </div>
      )}

      {/* ── In Review ── */}
      {reviewing.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/15">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">
              In Review
            </span>
            <span className="text-[10px] text-muted-foreground">({reviewing.length})</span>
          </div>
          <div className="space-y-1 pl-2 border-l-2 border-orange-500/40">
            {reviewing.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onClick={() => onClickItem(req)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Connector ── */}
      {(active.length > 0 || reviewing.length > 0) && sortedQueue.length > 0 && (
        <div className="flex justify-center">
          <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
        </div>
      )}

      {/* ── Queue ── */}
      {sortedQueue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500/15">
              <Clock className="h-3 w-3 text-yellow-500" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-yellow-400">
              Queue
            </span>
            <span className="text-[10px] text-muted-foreground">({sortedQueue.length})</span>
          </div>
          <div className="space-y-1 pl-2 border-l-2 border-yellow-500/30">
            {sortedQueue.map((req, i) => (
              <div key={req.id} className="flex items-start gap-2">
                <span className="text-[10px] text-muted-foreground/60 font-mono pt-2.5 w-4 text-right shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <RequestCard
                    req={req}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onClick={() => onClickItem(req)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TasksPageInner() {
  const { requests, isLoading, error, updateRequest, deleteRequest } = useRequests();
  const { groups } = useTasks();
  const allWaterfallTasks = groups.flatMap((g) => g.tasks);
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || TAB_STACK;

  const setActiveTab = (tab: string) => {
    router.push(`/tasks?tab=${tab}`, { scroll: false });
  };

  const grouped: Record<string, RequestItem[]> = {
    pending: requests.filter((r) => r.status === "pending"),
    reviewing: requests.filter((r) => r.status === "reviewing"),
    in_progress: requests.filter((r) => r.status === "in_progress"),
    rejected: requests.filter((r) => r.status === "rejected"),
    done: requests.filter((r) => r.status === "done"),
  };

  const filteredStatuses = activeTab === TAB_ALL
    ? STATUS_ORDER.filter((s) => grouped[s].length > 0)
    : [activeTab];

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading tasks...</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Tasks</h1>
          <AutoImproveControl />
        </div>
        <button
          type="button"
          onClick={() => router.push("/tasks/new")}
          className="filter-pill active flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          New Task
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => {
          const count = tab === TAB_ALL
            ? requests.length
            : tab === TAB_STACK
              ? (grouped.in_progress?.length ?? 0) + (grouped.reviewing?.length ?? 0) + (grouped.pending?.length ?? 0)
              : grouped[tab]?.length ?? 0;
          return (
            <span key={tab} className="flex items-center">
              <button
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px",
                  activeTab === tab
                    ? tab === TAB_STACK
                      ? "border-violet-400 text-violet-400"
                      : "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab === TAB_STACK && (
                  <Layers className="h-3 w-3 shrink-0" />
                )}
                {tab !== TAB_ALL && tab !== TAB_STACK && (
                  <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[tab])} />
                )}
                {TAB_LABEL[tab]}
                <span className="text-[10px] text-muted-foreground">({count})</span>
              </button>
              {tab === TAB_STACK && (
                <span className="h-4 w-px bg-border mx-1" />
              )}
            </span>
          );
        })}
      </div>

      {activeTab === TAB_STACK && (
        <StackView
          requests={requests}
          tasks={allWaterfallTasks}
          onUpdate={updateRequest}
          onDelete={deleteRequest}
          onClickItem={(req) => router.push(`/tasks/${displayTaskId(req.id)}`)}
        />
      )}

      {activeTab !== TAB_STACK && filteredStatuses.map((status) => {
        const items = grouped[status];
        if (!items || items.length === 0) return null;
        return (
          <div key={status}>
            {activeTab === TAB_ALL && (
              <div className="flex items-center gap-2 mb-2">
                {status === "in_progress" ? (
                  <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[status])} />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {STATUS_LABEL[status]}
                </span>
                <span className="text-[10px] text-muted-foreground">({items.length})</span>
              </div>
            )}
            <div className="space-y-1">
              {items.map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  onUpdate={updateRequest}
                  onDelete={deleteRequest}
                  onClick={() => router.push(`/tasks/${displayTaskId(req.id)}`)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {activeTab !== TAB_STACK && requests.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No tasks yet. Click &quot;New Task&quot; to create a task.</p>
        </div>
      )}

      {activeTab !== TAB_ALL && activeTab !== TAB_STACK && (grouped[activeTab]?.length ?? 0) === 0 && requests.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No {TAB_LABEL[activeTab]} tasks.</p>
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
      <TasksPageInner />
    </Suspense>
  );
}
