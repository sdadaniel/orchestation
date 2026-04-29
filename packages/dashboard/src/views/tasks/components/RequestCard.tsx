"use client";

import { useState, useEffect, memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Pencil,
  Trash2,
  Square,
  Bot,
  Terminal,
  FileText,
  FolderOpen,
} from "lucide-react";
import { type RequestItem } from "@/hooks/useRequests";
import { PRIORITY_COLORS, STATUS_DOT } from "@/app/tasks/constants";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

type CardTab = "content" | "scope" | "ai-result" | "logs";

export const RequestCard = memo(
  function RequestCard({
    req,
    onUpdate,
    onDelete,
    onReorder,
    isFirst,
    isLast,
  }: {
    req: RequestItem;
    onUpdate: (
      id: string,
      updates: Partial<
        Pick<RequestItem, "status" | "title" | "content" | "priority">
      >,
    ) => Promise<void>;
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
    const [aiResult, setAiResult] = useState<
      { status: string; result: string } | null | "empty"
    >(null);
    const [aiResultLoading, setAiResultLoading] = useState(false);
    const [logContent, setLogContent] = useState<string | null | "empty">(null);
    const [logLoading, setLogLoading] = useState(false);
    const [cardTab, setCardTab] = useState<CardTab>("content");
    const isReadOnly = req.status === "done";

    // Lazy-load AI result
    useEffect(() => {
      if (cardTab === "ai-result" && aiResult === null && !aiResultLoading) {
        setAiResultLoading(true);
        fetch(`/api/tasks/${req.id}/result`)
          .then((r) => {
            if (!r.ok) throw new Error("fetch failed");
            return r.json();
          })
          .then((data) => setAiResult(data.status ? data : "empty"))
          .catch(() => setAiResult("empty"))
          .finally(() => setAiResultLoading(false));
      }
    }, [cardTab, aiResult, aiResultLoading, req.id]);

    // Lazy-load execution log
    useEffect(() => {
      if (cardTab === "logs" && logContent === null && !logLoading) {
        setLogLoading(true);
        fetch(`/api/tasks/${req.id}/log`)
          .then((r) => {
            if (!r.ok) throw new Error("fetch failed");
            return r.text();
          })
          .then((text) => setLogContent(text || "empty"))
          .catch(() => setLogContent("empty"))
          .finally(() => setLogLoading(false));
      }
    }, [cardTab, logContent, logLoading, req.id]);

    const tabs: { key: CardTab; label: string; icon: typeof FileText }[] = [
      { key: "content", label: "Content", icon: FileText },
      { key: "scope", label: "Scope", icon: FolderOpen },
      { key: "ai-result", label: "AI Result", icon: Bot },
      { key: "logs", label: "로그", icon: Terminal },
    ];

    return (
      <div className="board-card">
        <div
          className="flex items-center gap-2 h-10 cursor-pointer"
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
            <span
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                STATUS_DOT[req.status],
              )}
            />
          )}
          <Link
            href={`/tasks/${req.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[10px] text-muted-foreground/70 shrink-0 hover:text-primary hover:underline transition-colors"
          >
            {req.id}
          </Link>
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 leading-none",
              PRIORITY_COLORS[req.priority],
            )}
          >
            {req.priority}
          </span>
          <span
            className={cn(
              "text-[13px] flex-1 truncate text-left leading-snug",
              req.status === "done" || req.status === "rejected"
                ? "text-muted-foreground"
                : "font-medium",
            )}
          >
            {req.title}
          </span>
          {req.status === "in_progress" && (
            <button
              type="button"
              title="Stop"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(req.id, { status: "pending" });
              }}
              className="shrink-0 p-1 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors"
            >
              <Square className="h-3 w-3" />
            </button>
          )}
          <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
            {(req.updated || req.created).slice(0, 10)}
          </span>
          {onReorder && (
            <div
              className="flex flex-col shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                disabled={isFirst}
                onClick={() => onReorder(req.id, "up")}
                className={cn(
                  "p-0.5 rounded transition-colors",
                  isFirst
                    ? "text-muted-foreground/30 cursor-default"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                disabled={isLast}
                onClick={() => onReorder(req.id, "down")}
                className={cn(
                  "p-0.5 rounded transition-colors",
                  isLast
                    ? "text-muted-foreground/30 cursor-default"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <ChevronDown className="h-3 w-3" />
              </button>
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
              <div
                style={{ maxHeight: 260, scrollbarWidth: "none" }}
                className="overflow-y-auto px-1"
              >
                {editing ? (
                  <div className="space-y-2">
                    <Input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-sm"
                    />
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={4}
                      className="text-sm resize-y"
                    />
                    <div className="flex items-center gap-2">
                      <Select
                        size="inline"
                        value={editPriority}
                        onChange={(e) =>
                          setEditPriority(
                            e.target.value as RequestItem["priority"],
                          )
                        }
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </Select>
                      <button
                        type="button"
                        onClick={async () => {
                          await onUpdate(req.id, {
                            title: editTitle,
                            content: editContent,
                            priority: editPriority,
                          });
                          setEditing(false);
                        }}
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
                    {req.content ? (
                      <MarkdownContent>{req.content}</MarkdownContent>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        (No description)
                      </p>
                    )}
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
                          onClick={() => {
                            if (confirm(`${req.id} delete?`)) onDelete(req.id);
                          }}
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

            {/* Scope Tab */}
            {cardTab === "scope" && (
              <div
                style={{ maxHeight: 260, scrollbarWidth: "none" }}
                className="overflow-y-auto px-1"
              >
                {req.scope?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {req.scope.map((s, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Scope가 지정되지 않았습니다.
                  </p>
                )}
              </div>
            )}

            {/* AI Result Tab */}
            {cardTab === "ai-result" && (
              <div
                style={{ maxHeight: 260, scrollbarWidth: "none" }}
                className="overflow-y-auto px-1"
              >
                {aiResultLoading ? (
                  <p className="text-xs text-muted-foreground">Loading...</p>
                ) : aiResult && aiResult !== "empty" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        Status:
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold",
                          aiResult.status === "rejected"
                            ? "text-red-500"
                            : "text-emerald-500",
                        )}
                      >
                        {aiResult.status === "rejected" ? "REJECTED" : "DONE"}
                      </span>
                    </div>
                    {aiResult.result && (
                      <MarkdownContent>{aiResult.result}</MarkdownContent>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    아직 AI 결과가 없습니다.
                  </p>
                )}
              </div>
            )}

            {/* Logs Tab */}
            {cardTab === "logs" && (
              <div
                style={{ maxHeight: 260, scrollbarWidth: "none" }}
                className="overflow-y-auto px-1"
              >
                {logLoading ? (
                  <p className="text-xs text-muted-foreground">Loading...</p>
                ) : logContent && logContent !== "empty" ? (
                  <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {logContent}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    아직 실행 로그가 없습니다.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
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
