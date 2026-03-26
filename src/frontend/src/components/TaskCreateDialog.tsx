"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type TaskCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  sprintId?: string;
  existingTaskIds?: string[];
};

export function TaskCreateDialog({
  open,
  onClose,
  onCreated,
  sprintId,
  existingTaskIds = [],
}: TaskCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [role, setRole] = useState("general");
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setPriority("medium");
      setRole("general");
      setDependsOn([]);
      setError(null);
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [open]);

  const toggleDep = (taskId: string) => {
    setDependsOn((prev) =>
      prev.includes(taskId)
        ? prev.filter((d) => d !== taskId)
        : [...prev, taskId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          priority,
          role,
          depends_on: dependsOn,
          sprint: sprintId || "",
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || "Failed to create task");
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "태스크 생성에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>
            New Task{sprintId ? ` (${sprintId})` : ""}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <Label>
              제목 <span className="text-red-400">*</span>
            </Label>
            <Input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task 제목을 입력하세요"
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>우선순위</Label>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>역할</Label>
              <Select
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="general">General</option>
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
                <option value="infra">Infra</option>
                <option value="design">Design</option>
              </Select>
            </div>
          </div>

          {existingTaskIds.length > 0 && (
            <div className="space-y-1">
              <Label>의존성 (Depends On)</Label>
              <div className="max-h-32 overflow-y-auto bg-muted border border-border rounded p-2 space-y-1">
                {existingTaskIds.map((taskId) => (
                  <label
                    key={taskId}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-background/50 rounded px-1 py-0.5"
                  >
                    <Checkbox
                      checked={dependsOn.includes(taskId)}
                      onChange={() => toggleDep(taskId)}
                    />
                    <span className="font-mono">{taskId}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors"
              disabled={submitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs rounded bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? "생성 중..." : "생성"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
