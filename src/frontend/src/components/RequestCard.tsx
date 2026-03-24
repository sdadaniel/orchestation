"use client";

import { useState, useEffect, memo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, ChevronUp, Pencil, Trash2, Square, Bot } from "lucide-react";
import { type RequestItem } from "@/hooks/useRequests";
import { PRIORITY_COLORS, STATUS_DOT } from "@/app/tasks/constants";

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
  const [cardTab, setCardTab] = useState<"content" | "ai-result">("content");
  const isReadOnly = req.status === "done";

  useEffect(() => {
    if (expanded && aiResult === null && !aiResultLoading) {
      setAiResultLoading(true);
      fetch(`/api/tasks/${req.id}/result`).then((r) => { if (!r.ok) throw new Error("fetch failed"); return r.json(); }).then((data) => setAiResult(data.result ?? "")).catch(() => setAiResult("")).finally(() => setAiResultLoading(false));
    }
  }, [expanded, aiResult, aiResultLoading, req.id]);

  return (
    <div className="board-card">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        {req.status === "in_progress" ? <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" /> : <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[req.status])} />}
        <span className="font-mono text-[11px] text-muted-foreground shrink-0">{req.id}</span>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0", PRIORITY_COLORS[req.priority])}>{req.priority}</span>
        <span className="text-sm flex-1 truncate text-left">{req.title}</span>
        {req.status === "in_progress" && <button type="button" title="Stop" onClick={(e) => { e.stopPropagation(); onUpdate(req.id, { status: "pending" }); }} className="shrink-0 p-1 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors"><Square className="h-3 w-3" /></button>}
        <span className="text-[10px] text-muted-foreground shrink-0">{req.created}</span>
        {onReorder && (
          <div className="flex flex-col shrink-0" onClick={(e) => e.stopPropagation()}>
            <button type="button" disabled={isFirst} onClick={() => onReorder(req.id, "up")} className={cn("p-0.5 rounded transition-colors", isFirst ? "text-muted-foreground/30 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted")}><ChevronUp className="h-3 w-3" /></button>
            <button type="button" disabled={isLast} onClick={() => onReorder(req.id, "down")} className={cn("p-0.5 rounded transition-colors", isLast ? "text-muted-foreground/30 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted")}><ChevronDown className="h-3 w-3" /></button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex items-center gap-1 mb-2 border-b border-border">
            <button type="button" onClick={() => setCardTab("content")} className={cn("px-2.5 py-1 text-[11px] font-medium border-b-2 -mb-px transition-colors", cardTab === "content" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>Content</button>
            <button type="button" onClick={() => setCardTab("ai-result")} className={cn("flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border-b-2 -mb-px transition-colors", cardTab === "ai-result" ? "border-blue-400 text-blue-400" : "border-transparent text-muted-foreground hover:text-foreground")}><Bot className="h-3 w-3" />AI Result</button>
          </div>
          {cardTab === "content" && (
            <div style={{ minHeight: 150 }}>
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
                  <p className="text-sm text-foreground whitespace-pre-wrap">{req.content || "(No description)"}</p>
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
          {cardTab === "ai-result" && (
            <div style={{ minHeight: 150 }}>
              {aiResultLoading ? <p className="text-xs text-muted-foreground">Loading...</p> : aiResult ? <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{aiResult}</p> : <p className="text-xs text-muted-foreground">No result available.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
