"use client";

import { cn } from "@/lib/utils";
import { Loader2, Play, Square, Trash2 } from "lucide-react";
import { HorseRunningIndicator } from "@/components/HorseRunningIndicator";
import { BranchBadge } from "@/components/task-detail/BranchBadge";
import { Select } from "@/components/ui/select";
import { TaskDetail, STATUS_DOT, STATUS_LABEL, PRIORITY_COLORS } from "./types";

interface TaskMetadataProps {
  task: TaskDetail;
  runStatus: "idle" | "running" | "completed" | "failed";
  isPipelineRunning: boolean;
  onStatusChange: (newStatus: string) => Promise<void>;
  onRun: () => Promise<void>;
  onStop: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function TaskMetadata({
  task,
  runStatus,
  isPipelineRunning,
  onStatusChange,
  onRun,
  onStop,
  onDelete,
}: TaskMetadataProps) {
  return (
    <>
      {/* Meta */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {task.status === "in_progress" ? (
            <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[task.status])} />
          )}
          <Select
            value={task.status}
            onChange={(e) => onStatusChange(e.target.value)}
            size="inline"
            className="text-xs font-medium"
          >
            {["pending", "stopped", "in_progress", "reviewing", "done", "failed", "rejected"].map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>
            ))}
          </Select>
        </div>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", PRIORITY_COLORS[task.priority])}>
          {task.priority}
        </span>
        <span className="text-[11px] text-muted-foreground">
          Created: {task.created}
        </span>
        {task.branch && <BranchBadge branch={task.branch} />}

        {/* Run / Stop / Delete buttons */}
        <div className="ml-auto flex items-center gap-2">
          {runStatus === "running" && (
            <HorseRunningIndicator />
          )}
          {task.status === "pending" && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/50 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              삭제
            </button>
          )}
          {runStatus === "running" || task.status === "in_progress" ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              <Square className="h-3 w-3" />
              중지
            </button>
          ) : (
            <button
              type="button"
              onClick={onRun}
              disabled={isPipelineRunning || task.status === "in_progress" || task.status === "done" || task.status === "rejected"}
              title={
                isPipelineRunning
                  ? "파이프라인 실행 중에는 개별 실행 불가"
                  : task.status === "in_progress"
                    ? "이미 실행 중인 태스크입니다"
                    : task.status === "done" || task.status === "rejected"
                      ? "완료된 태스크입니다"
                      : `${task.id} 실행`
              }
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors",
                isPipelineRunning || task.status === "in_progress" || task.status === "done" || task.status === "rejected"
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-muted hover:bg-muted/80 text-foreground border border-border",
              )}
            >
              <Play className="h-3 w-3" />
              실행
            </button>
          )}
        </div>
      </div>

      {/* Run status banner */}
      {runStatus === "running" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          태스크 실행 중...
        </div>
      )}
      {runStatus === "failed" && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          실행 실패
        </div>
      )}
    </>
  );
}
