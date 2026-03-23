"use client";

import { useState, useCallback } from "react";
import { GripVertical, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATUS_STYLES,
  PRIORITY_STYLES,
  type TaskStatus,
  type TaskPriority,
} from "../../lib/constants";

type BatchTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  role: string;
  depends_on: string[];
  batch: string;
};

type Batch = {
  name: string;
  tasks: BatchTask[];
};

type BatchEditorProps = {
  batches: Batch[];
  onSave: (updates: { id: string; status?: string; priority?: string }[]) => Promise<void>;
  onClose: () => void;
};

export function BatchEditor({ batches, onSave, onClose }: BatchEditorProps) {
  const allTasks = batches.flatMap((b) => b.tasks);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchStatus, setBatchStatus] = useState("");
  const [batchPriority, setBatchPriority] = useState("");
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [taskOrder, setTaskOrder] = useState<BatchTask[]>(allTasks);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = () => {
    if (selected.size === taskOrder.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(taskOrder.map((t) => t.id)));
    }
  };

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    setTaskOrder((prev) => {
      const items = [...prev];
      const fromIdx = items.findIndex((t) => t.id === draggedId);
      const toIdx = items.findIndex((t) => t.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      return items;
    });
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const handleApply = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const updates: { id: string; status?: string; priority?: string }[] = [];
      for (const id of selected) {
        const update: { id: string; status?: string; priority?: string } = { id };
        if (batchStatus) update.status = batchStatus;
        if (batchPriority) update.priority = batchPriority;
        if (batchStatus || batchPriority) updates.push(update);
      }
      if (updates.length > 0) {
        await onSave(updates);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === taskOrder.length && taskOrder.length > 0}
              onChange={selectAll}
              className="rounded"
            />
            <span className="text-muted-foreground">
              {selected.size > 0
                ? `${selected.size}개 선택됨`
                : "전체 선택"}
            </span>
          </label>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Batch controls */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-b border-border">
          <span className="text-[10px] text-muted-foreground uppercase shrink-0">
            일괄 변경:
          </span>
          <select
            value={batchStatus}
            onChange={(e) => setBatchStatus(e.target.value)}
            className="bg-muted border border-border rounded px-2 py-0.5 text-xs outline-none"
          >
            <option value="">상태 선택</option>
            <option value="backlog">Backlog</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="done">Done</option>
          </select>
          <select
            value={batchPriority}
            onChange={(e) => setBatchPriority(e.target.value)}
            className="bg-muted border border-border rounded px-2 py-0.5 text-xs outline-none"
          >
            <option value="">우선순위 선택</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            type="button"
            onClick={handleApply}
            disabled={saving || (!batchStatus && !batchPriority)}
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            {saving ? "적용 중..." : "적용"}
          </button>
        </div>
      )}

      {/* Task list with drag */}
      <div className="max-h-80 overflow-y-auto">
        {taskOrder.map((task) => {
          const statusStyle = STATUS_STYLES[task.status as TaskStatus];
          const priorityStyle =
            PRIORITY_STYLES[task.priority as TaskPriority] ??
            PRIORITY_STYLES.medium;
          const isDragging = draggedId === task.id;

          return (
            <div
              key={task.id}
              draggable
              onDragStart={() => handleDragStart(task.id)}
              onDragOver={(e) => handleDragOver(e, task.id)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors cursor-grab",
                isDragging && "opacity-40",
                selected.has(task.id) && "bg-primary/5",
              )}
            >
              <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
              <input
                type="checkbox"
                checked={selected.has(task.id)}
                onChange={() => toggleSelect(task.id)}
                className="rounded shrink-0"
              />
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  statusStyle?.dot ?? "bg-gray-400",
                )}
              />
              <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-16">
                {task.id}
              </span>
              <span className="text-xs truncate flex-1">{task.title}</span>
              <span
                className={cn(
                  "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold shrink-0",
                  priorityStyle.bg,
                  priorityStyle.text,
                )}
              >
                {priorityStyle.label}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {task.batch}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
