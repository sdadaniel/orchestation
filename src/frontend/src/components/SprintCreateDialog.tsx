"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type SprintCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function SprintCreateDialog({
  open,
  onClose,
  onCreated,
}: SprintCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [status, setStatus] = useState("ready");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setGoal("");
      setStatus("ready");
      setError(null);
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          goal: goal.trim(),
          status,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || "Failed to create sprint");
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "스프린트 생성에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>New Sprint</DialogTitle>
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
              placeholder="Sprint 제목을 입력하세요"
              maxLength={200}
            />
          </div>

          <div className="space-y-1">
            <Label>목표</Label>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Sprint 목표를 입력하세요"
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="space-y-1">
            <Label>상태</Label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="ready">Ready</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </Select>
          </div>

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
