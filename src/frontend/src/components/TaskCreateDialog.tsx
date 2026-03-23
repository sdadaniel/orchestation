"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

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

  if (!open) return null;

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
        const data = await res.json();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">
            New Task{sprintId ? ` (${sprintId})` : ""}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              제목 <span className="text-red-400">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task 제목을 입력하세요"
              className="w-full bg-muted border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-primary transition-colors"
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                우선순위
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-muted border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-primary transition-colors"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                역할
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-muted border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-primary transition-colors"
              >
                <option value="general">General</option>
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
                <option value="infra">Infra</option>
                <option value="design">Design</option>
              </select>
            </div>
          </div>

          {existingTaskIds.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                의존성 (Depends On)
              </label>
              <div className="max-h-32 overflow-y-auto bg-muted border border-border rounded p-2 space-y-1">
                {existingTaskIds.map((taskId) => (
                  <label
                    key={taskId}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-background/50 rounded px-1 py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={dependsOn.includes(taskId)}
                      onChange={() => toggleDep(taskId)}
                      className="rounded"
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
      </div>
    </div>
  );
}
