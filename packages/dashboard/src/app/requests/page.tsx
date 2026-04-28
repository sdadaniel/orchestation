"use client";

import { useState } from "react";
import { useRequests, type RequestItem } from "@/hooks/useRequests";
import { cn } from "@/lib/utils";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import AutoImproveControl from "@/components/AutoImproveControl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { PageLayout, PageHeader } from "@/components/ui/page-layout";

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

const STATUS_ORDER = [
  "pending",
  "reviewing",
  "in_progress",
  "rejected",
  "done",
];

function RequestCard({
  req,
  onUpdate,
  onDelete,
}: {
  req: RequestItem;
  onUpdate: (
    id: string,
    updates: Partial<
      Pick<RequestItem, "status" | "title" | "content" | "priority">
    >,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(req.title);
  const [editContent, setEditContent] = useState(req.content);
  const [editPriority, setEditPriority] = useState(req.priority);
  const isReadOnly = req.status === "done";

  const handleSave = async () => {
    await onUpdate(req.id, {
      title: editTitle,
      content: editContent,
      priority: editPriority,
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (confirm(`${req.id} 를 삭제하시겠습니까?`)) {
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
          <span
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              STATUS_DOT[req.status],
            )}
          />
        )}
        <span className="font-mono text-[11px] text-muted-foreground shrink-0">
          {req.id}
        </span>
        <span className="text-sm flex-1 truncate">{req.title}</span>
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0",
            PRIORITY_COLORS[req.priority],
          )}
        >
          {req.priority}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {req.created}
        </span>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-border">
          {editing ? (
            <div className="space-y-2">
              <Input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                size="sm"
              />
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
                size="sm"
              />
              <div className="flex items-center gap-2">
                <Select
                  value={editPriority}
                  onChange={(e) =>
                    setEditPriority(e.target.value as RequestItem["priority"])
                  }
                  size="sm"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
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
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {req.content || "(No description)"}
              </p>
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
    </div>
  );
}

export default function RequestsPage() {
  const {
    requests,
    isLoading,
    error,
    createRequest,
    updateRequest,
    deleteRequest,
  } = useRequests();
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">(
    "medium",
  );

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createRequest(newTitle, newContent, newPriority);
    setNewTitle("");
    setNewContent("");
    setNewPriority("medium");
    setShowForm(false);
  };

  const grouped: Record<string, RequestItem[]> = {
    pending: requests.filter((r) => r.status === "pending"),
    reviewing: requests.filter((r) => r.status === "reviewing"),
    in_progress: requests.filter((r) => r.status === "in_progress"),
    rejected: requests.filter((r) => r.status === "rejected"),
    done: requests.filter((r) => r.status === "done"),
  };

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading tasks...</div>
    );
  }

  if (error) {
    return <div className="p-4 text-sm text-red-500">{error}</div>;
  }

  return (
    <PageLayout>
      <PageHeader title="Tasks">
        <AutoImproveControl />
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="filter-pill active flex items-center gap-1"
        >
          {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showForm ? "Cancel" : "New Task"}
        </button>
      </PageHeader>

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <Input
            type="text"
            placeholder="Task title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) handleCreate();
            }}
            autoFocus
          />
          <Textarea
            placeholder="Describe the task..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={4}
          />
          <div className="flex items-center gap-3">
            <Select
              value={newPriority}
              onChange={(e) =>
                setNewPriority(e.target.value as "high" | "medium" | "low")
              }
              size="sm"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newTitle.trim()}
              className={cn(
                "filter-pill",
                newTitle.trim() ? "active" : "opacity-50 cursor-not-allowed",
              )}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {STATUS_ORDER.map((status) => {
        const items = grouped[status];
        if (items.length === 0) return null;
        return (
          <div key={status}>
            <div className="flex items-center gap-2 mb-2">
              {status === "in_progress" ? (
                <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span
                  className={cn("w-2 h-2 rounded-full", STATUS_DOT[status])}
                />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {STATUS_LABEL[status]}
              </span>
              <span className="text-[10px] text-muted-foreground">
                ({items.length})
              </span>
            </div>
            <div className="space-y-1">
              {items.map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  onUpdate={updateRequest}
                  onDelete={deleteRequest}
                />
              ))}
            </div>
          </div>
        );
      })}

      {requests.length === 0 && !showForm && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">
            No tasks yet. Click "New Task" to create a task.
          </p>
        </div>
      )}
    </PageLayout>
  );
}
