import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import type { RequestItem } from "@/hooks/useRequests";
import type { RequestCardProps } from "./types";

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

export function RequestCard({ req, onUpdate, onDelete }: RequestCardProps) {
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
            className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[req.status])}
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
