"use client";

import { useState, useEffect } from "react";
import { getErrorMessage } from "@/lib/error-utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import {
  STATUS_STYLES,
  PRIORITY_STYLES,
  type TaskStatus,
  type TaskPriority,
} from "../../lib/constants";

type TaskData = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  role: string;
  depends_on: string[];
  blocks: string[];
};

type TaskEditSheetProps = {
  task: TaskData | null;
  onClose: () => void;
  onUpdated: () => void;
  onDeleteRequest: (taskId: string) => void;
  existingTaskIds?: string[];
};

export function TaskEditSheet({
  task,
  onClose,
  onUpdated,
  onDeleteRequest,
  existingTaskIds = [],
}: TaskEditSheetProps) {
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [role, setRole] = useState("");
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (task) {
      setStatus(task.status);
      setPriority(task.priority);
      setRole(task.role);
      setDependsOn([...task.depends_on]);
      setError(null);
      setDirty(false);
    }
  }, [task]);

  const open = task !== null;

  const toggleDep = (taskId: string) => {
    setDirty(true);
    setDependsOn((prev) =>
      prev.includes(taskId)
        ? prev.filter((d) => d !== taskId)
        : [...prev, taskId],
    );
  };

  const handleSave = async () => {
    if (!task) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          priority,
          role,
          depends_on: dependsOn,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || "Failed to update task");
      }

      setDirty(false);
      onUpdated();
      onClose();
    } catch (err) {
      setError(
        getErrorMessage(err, "태스크 수정에 실패했습니다."),
      );
    } finally {
      setSaving(false);
    }
  };

  const statusStyle = task
    ? STATUS_STYLES[task.status]
    : undefined;
  const priorityStyle = task
    ? (PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium)
    : undefined;

  // Available tasks for dependency selection (excluding self)
  const availableDeps = existingTaskIds.filter((id) => id !== task?.id);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="overflow-y-auto">
        {task && (
          <>
            <SheetHeader>
              <SheetDescription className="font-mono text-xs">
                {task.id}
              </SheetDescription>
              <SheetTitle>{task.title}</SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 pb-4">
              {/* Current badges */}
              <div className="flex flex-wrap gap-1.5">
                {statusStyle && (
                  <StatusBadge status={task.status} />
                )}
                {priorityStyle && (
                  <PriorityBadge priority={task.priority} />
                )}
              </div>

              {error && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                  {error}
                </div>
              )}

              {/* Status */}
              <div className="space-y-1">
                <Label size="sm">Status</Label>
                <Select
                  size="sm"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setDirty(true);
                  }}
                >
                  <option value="stopped">Stopped</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="reviewing">Reviewing</option>
                  <option value="done">Done</option>
                  <option value="rejected">Rejected</option>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <Label size="sm">Priority</Label>
                <Select
                  size="sm"
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value);
                    setDirty(true);
                  }}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
              </div>

              {/* Role */}
              <div className="space-y-1">
                <Label size="sm">Role</Label>
                <Select
                  size="sm"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setDirty(true);
                  }}
                >
                  <option value="general">General</option>
                  <option value="frontend">Frontend</option>
                  <option value="backend">Backend</option>
                  <option value="infra">Infra</option>
                  <option value="design">Design</option>
                </Select>
              </div>

              {/* Dependencies */}
              <div className="space-y-1">
                <Label size="sm">Depends On</Label>
                {availableDeps.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto bg-muted border border-border rounded p-2 space-y-0.5">
                    {availableDeps.map((depId) => (
                      <label
                        key={depId}
                        className="flex items-center gap-2 text-xs cursor-pointer hover:bg-background/50 rounded px-1 py-0.5"
                      >
                        <Checkbox
                          checked={dependsOn.includes(depId)}
                          onChange={() => toggleDep(depId)}
                        />
                        <span className="font-mono">{depId}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No other tasks available
                  </span>
                )}
              </div>

              {/* Blocks (read-only) */}
              <div className="space-y-1">
                <Label size="sm">Blocks</Label>
                {task.blocks.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {task.blocks.map((id) => (
                      <span
                        key={id}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="flex-1 px-3 py-1.5 text-xs rounded bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRequest(task.id)}
                  className="px-3 py-1.5 text-xs rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
