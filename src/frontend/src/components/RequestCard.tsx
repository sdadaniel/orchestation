"use client";

import { useState, useEffect, memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, ChevronUp, Pencil, Trash2, Square, Bot, Terminal, ClipboardCheck, FileText, FolderOpen } from "lucide-react";
import { type RequestItem } from "@/hooks/useRequests";
import { PRIORITY_COLORS, STATUS_DOT } from "@/app/tasks/constants";
import { MarkdownContent } from "@/components/MarkdownContent";

interface ExecutionLog {
  subtype?: string;
  num_turns?: number;
  duration_ms?: number;
  total_cost_usd?: number;
  result?: string;
}

interface ReviewResult {
  subtype?: string;
  result?: string;
}

type CardTab = "content" | "scope" | "ai-result" | "logs" | "review";

export const RequestCard = memo(function RequestCard({ req, onUpdate, onDelete, onReorder, isFirst, isLast }: {
  req: RequestItem;
  onUpdate: (id: string, updates: Partial<Pick<RequestItem, "status" | "title" | "content" | "priority">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder?: (id: string, direction: "up" | "down") => Promise<void>;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(req.title);
  const [editContent, setEditContent] = useState(req.content);
  const [editPriority, setEditPriority] = useState(req.priority);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiResultLoading, setAiResultLoading] = useState(false);
  const [execLog, setExecLog] = useState<ExecutionLog | null>(null);
  const [execLogLoading, setExecLogLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [cardTab, setCardTab] = useState<CardTab>("content");
  const isReadOnly = req.status === "done";

  // Lazy-load AI result
  useEffect(() => {
    if (expanded && aiResult === null && !aiResultLoading) {
      setAiResultLoading(true);
      fetch(`/api/tasks/${req.id}/result`).then((r) => { if (!r.ok) throw new Error("fetch failed"); return r.json(); }).then((data) => setAiResult(data.result ?? "")).catch(() => setAiResult("")).finally(() => setAiResultLoading(false));
    }
  }, [expanded, aiResult, aiResultLoading, req.id]);

  // Lazy-load execution log + review when switching tabs (single fetch for both)
  useEffect(() => {
    const needsLog = cardTab === "logs" && execLog === null && !execLogLoading;
    const needsReview = cardTab === "review" && reviewResult === null && !reviewLoading;
    if (needsLog || needsReview) {
      if (needsLog) setExecLogLoading(true);
      if (needsReview) setReviewLoading(true);
      fetch(`/api/requests/${req.id}`)
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((data) => {
          setExecLog(data.executionLog ?? null);
          setReviewResult(data.reviewResult ?? null);
        })
        .catch(() => {
          setExecLog(null);
          setReviewResult(null);
        })
        .finally(() => {
          setExecLogLoading(false);
          setReviewLoading(false);
        });
    }
  }, [cardTab, execLog, execLogLoading, reviewResult, reviewLoading, req.id]);

  const tabs: { key: CardTab; label: string; icon: typeof FileText }[] = [
    { key: "content", label: "Content", icon: FileText },
    { key: "scope", label: "Scope", icon: FolderOpen },
    { key: "ai-result", label: "AI Result", icon: Bot },
    { key: "logs", label: "로그", icon: Terminal },
    { key: "review", label: "리뷰 결과", icon: ClipboardCheck },
  ];

  const statusAccent = {
    in_progress: "#3b82f6",
    reviewing: "#f97316",
    done: "#22c55e",
    rejected: "#ef4444",
    stopped: "#8b5cf6",
  } as Record<string, string>;

  return (
    <div
      className="board-card"
      style={statusAccent[req.status] ? { borderLeftWidth: "2px", borderLeftColor: statusAccent[req.status] } : undefined}
    >
      <div className="flex items-center gap-2 h-10 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        {req.status === "in_progress" ? (
          <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[req.status])} />
        )}
        <Link href={`/tasks/${req.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[10px] text-muted-foreground/70 shrink-0 hover:text-primary hover:underline transition-colors">{req.id}</Link>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 leading-none", PRIORITY_COLORS[req.priority])}>{req.priority}</span>
        <span className={cn("text-[13px] flex-1 truncate text-left leading-snug", req.status === "done" || req.status === "rejected" ? "text-muted-foreground" : "font-medium")}>{req.title}</span>
        {req.status === "in_progress" && (
          <button type="button" title="Stop" onClick={(e) => { e.stopPropagation(); onUpdate(req.id, { status: "pending" }); }} className="shrink-0 p-1 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors">
            <Square className="h-3 w-3" />
          </button>
        )}
        <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">{(req.updated || req.created).slice(0, 10)}</span>
        {onReorder && (
          <div className="flex flex-col shrink-0" onClick={(e) => e.stopPropagation()}>
            <button type="button" disabled={isFirst} onClick={() => onReorder(req.id, "up")} className={cn("p-0.5 rounded transition-colors", isFirst ? "text-muted-foreground/30 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted")}><ChevronUp className="h-3 w-3" /></button>
            <button type="button" disabled={isLast} onClick={() => onReorder(req.id, "down")} className={cn("p-0.5 rounded transition-colors", isLast ? "text-muted-foreground/30 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted")}><ChevronDown className="h-3 w-3" /></button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-border/60 px-1 pb-1">
          {/* Tabs */}
          <div className="flex items-center gap-0.5 mb-2 border-b border-border/60">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCardTab(tab.key)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium border-b-2 -mb-px transition-colors rounded-t",
                  cardTab === tab.key
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <tab.icon className="h-3 w-3" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Tab */}
          {cardTab === "content" && (
            <div style={{ maxHeight: 260, scrollbarWidth: "none" }} className="overflow-y-auto px-1">
              {editing ? (
                <div className="space-y-2">
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-muted border border-border rounded px-2 py-1 text-sm outline-none focus:border-primary" />
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={4} className="w-full bg-muted border border-border rounded px-2 py-1 text-sm outline-none focus:border-primary resize-y" />
                  <div className="flex items-center gap-2">
                    <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as RequestItem["priority"])} className="bg-muted border border-border rounded px-2 py-1 text-xs outline-none"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
                    <button type="button" onClick={async () => { await onUpdate(req.id, { title: editTitle, content: editContent, priority: editPriority }); setEditing(false); }} className="filter-pill active text-xs">Save</button>
                    <button type="button" onClick={() => { setEditing(false); setEditTitle(req.title); setEditContent(req.content); setEditPriority(req.priority); }} className="filter-pill text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  {req.content ? <MarkdownContent>{req.content}</MarkdownContent> : <p className="text-sm text-muted-foreground">(No description)</p>}
                  {!isReadOnly && (
                    <div className="flex items-center gap-2 mt-2">
                      <button type="button" onClick={() => setEditing(true)} className="filter-pill text-xs flex items-center gap-1"><Pencil className="h-3 w-3" />Edit</button>
                      <button type="button" onClick={() => { if (confirm(`${req.id} delete?`)) onDelete(req.id); }} className="filter-pill text-xs flex items-center gap-1 hover:text-red-400"><Trash2 className="h-3 w-3" />Delete</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Scope Tab */}
          {cardTab === "scope" && (
            <div style={{ maxHeight: 260, scrollbarWidth: "none" }} className="overflow-y-auto px-1">
              {req.scope?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {req.scope.map((s, i) => (
                    <span key={i} className="inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">{s}</span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Scope가 지정되지 않았습니다.</p>
              )}
            </div>
          )}

          {/* AI Result Tab */}
          {cardTab === "ai-result" && (
            <div style={{ maxHeight: 260, scrollbarWidth: "none" }} className="overflow-y-auto px-1">
              {aiResultLoading ? <p className="text-xs text-muted-foreground">Loading...</p> : aiResult ? <MarkdownContent>{aiResult}</MarkdownContent> : <p className="text-xs text-muted-foreground">아직 AI 결과가 없습니다.</p>}
            </div>
          )}

          {/* Logs Tab */}
          {cardTab === "logs" && (
            <div style={{ maxHeight: 260, scrollbarWidth: "none" }} className="overflow-y-auto px-1">
              {execLogLoading ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : execLog ? (
                <div className="space-y-3">
                  <div className="text-xs space-y-1">
                    {execLog.subtype && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">Result:</span>
                        <span className={cn("font-medium", execLog.subtype === "success" ? "text-emerald-500" : "text-red-500")}>{String(execLog.subtype)}</span>
                      </div>
                    )}
                    {execLog.num_turns !== undefined && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">Turns:</span>
                        <span>{String(execLog.num_turns)}</span>
                      </div>
                    )}
                    {execLog.duration_ms !== undefined && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">Duration:</span>
                        <span>{(Number(execLog.duration_ms) / 1000).toFixed(1)}s</span>
                      </div>
                    )}
                    {execLog.total_cost_usd !== undefined && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">Cost:</span>
                        <span>${Number(execLog.total_cost_usd).toFixed(4)}</span>
                      </div>
                    )}
                  </div>
                  {execLog.result && (
                    <div className="p-3 bg-muted rounded max-h-60 overflow-y-auto">
                      <MarkdownContent>{String(execLog.result)}</MarkdownContent>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">아직 실행 로그가 없습니다.</p>
              )}
            </div>
          )}

          {/* Review Tab */}
          {cardTab === "review" && (
            <div style={{ maxHeight: 260, scrollbarWidth: "none" }} className="overflow-y-auto px-1">
              {reviewLoading ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : reviewResult ? (
                <div className="space-y-3">
                  {reviewResult.subtype && (
                    <div className="text-xs flex gap-2">
                      <span className="text-muted-foreground w-20 shrink-0">Result:</span>
                      <span className={cn("font-medium", reviewResult.subtype === "success" ? "text-emerald-500" : "text-red-500")}>
                        {reviewResult.subtype === "success" ? "Approved" : String(reviewResult.subtype)}
                      </span>
                    </div>
                  )}
                  {reviewResult.result && (
                    <div className="p-3 bg-muted rounded max-h-60 overflow-y-auto">
                      <MarkdownContent>{String(reviewResult.result)}</MarkdownContent>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">아직 리뷰 결과가 없습니다.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}, (prev, next) =>
  prev.req.id === next.req.id &&
  prev.req.title === next.req.title &&
  prev.req.status === next.req.status &&
  prev.req.priority === next.req.priority &&
  prev.req.content === next.req.content &&
  prev.req.updated === next.req.updated &&
  prev.req.sort_order === next.req.sort_order &&
  prev.isFirst === next.isFirst &&
  prev.isLast === next.isLast &&
  (prev.onReorder === undefined) === (next.onReorder === undefined),
);
