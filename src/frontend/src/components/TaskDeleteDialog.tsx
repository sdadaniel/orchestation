"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

type TaskDeleteDialogProps = {
  taskId: string | null;
  onClose: () => void;
  onDeleted: () => void;
};

export function TaskDeleteDialog({
  taskId,
  onClose,
  onDeleted,
}: TaskDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!taskId) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete task");
      }

      onDeleted();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "태스크 삭제에 실패했습니다.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Task 삭제
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
              {error}
            </div>
          )}

          <p className="text-sm">
            <span className="font-mono font-semibold">{taskId}</span>를
            삭제하시겠습니까?
          </p>
          <p className="text-xs text-muted-foreground">
            이 작업은 되돌릴 수 없습니다. Task 파일이 삭제되고 관련
            Sprint에서도 제거됩니다.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors"
              disabled={deleting}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              disabled={deleting}
            >
              {deleting ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
