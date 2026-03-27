"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getErrorMessage } from "@/lib/error-utils";
import { X, Terminal, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WaterfallTask } from "@/types/waterfall";

interface TaskLogModalProps {
  task: WaterfallTask;
  onClose: () => void;
}

export function TaskLogModal({ task, onClose }: TaskLogModalProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"log" | "info">("log");
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Fetch logs filtered by task ID
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/orchestrate/logs?since=0`);
      if (!res.ok) throw new Error("로그를 불러올 수 없습니다.");
      const data = await res.json() as { logs?: string[] };

      if (!data.logs || !Array.isArray(data.logs)) {
        setLogs([]);
        return;
      }

      // Filter logs relevant to this task
      const taskId = task.id;
      const filtered = data.logs.filter((line: string) => {
        const lower = line.toLowerCase();
        const taskIdLower = taskId.toLowerCase();
        return (
          lower.includes(taskIdLower) ||
          lower.includes(taskIdLower.replace("-", "_"))
        );
      });

      setLogs(filtered.length > 0 ? filtered : []);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "알 수 없는 오류"));
    } finally {
      setIsLoading(false);
    }
  }, [task.id]);

  useEffect(() => {
    fetchLogs();
    // Poll every 3 seconds if task is in progress
    if (task.status === "in_progress") {
      const interval = setInterval(fetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [fetchLogs, task.status]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (!logContainerRef.current) return;
    const el = logContainerRef.current;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(isAtBottom);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const statusLabel: Record<string, string> = {
    stopped: "Stopped",
    pending: "Pending",
    in_progress: "In Progress",
    reviewing: "Reviewing",
    done: "Done",
    rejected: "Rejected",
  };

  const statusColor: Record<string, string> = {
    stopped: "text-violet-500",
    pending: "text-zinc-400",
    in_progress: "text-blue-500",
    reviewing: "text-orange-400",
    done: "text-emerald-500",
    rejected: "text-red-500",
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl w-[720px] max-w-[90vw] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{task.id}</span>
              <span className={cn("text-xs font-medium", statusColor[task.status] ?? "text-muted-foreground")}>
                {statusLabel[task.status] ?? task.status}
              </span>
            </div>
            <h3 className="text-sm font-medium truncate">{task.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-1 border-b border-border shrink-0 bg-muted/30">
          <button
            type="button"
            onClick={() => setActiveTab("log")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors",
              activeTab === "log"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Terminal className="h-3 w-3" />
            실행 로그
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors",
              activeTab === "info"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <FileText className="h-3 w-3" />
            태스크 정보
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "log" ? (
            <div className="h-full flex flex-col">
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm">로그 불러오는 중...</span>
                </div>
              ) : error ? (
                <div className="flex-1 flex items-center justify-center text-red-400 text-sm px-4">
                  {error}
                </div>
              ) : logs.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  이 태스크에 대한 실행 로그가 없습니다.
                </div>
              ) : (
                <div
                  ref={logContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5 bg-zinc-950/50"
                >
                  {logs.map((line, i) => (
                    <div key={i} className="text-zinc-300 whitespace-pre-wrap break-all hover:bg-white/5 px-1 rounded">
                      <span className="text-zinc-600 select-none mr-2">{String(i + 1).padStart(4)}</span>
                      {line}
                    </div>
                  ))}
                </div>
              )}
              {task.status === "in_progress" && !isLoading && (
                <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border bg-blue-500/5 text-blue-400 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  실시간 업데이트 중...
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-3 overflow-y-auto h-full">
              <InfoRow label="ID" value={task.id} />
              <InfoRow label="제목" value={task.title} />
              <InfoRow label="상태" value={statusLabel[task.status] ?? task.status} />
              <InfoRow label="우선순위" value={task.priority} />
              <InfoRow label="역할" value={task.role || "-"} />
              {task.depends_on.length > 0 && (
                <InfoRow label="의존성" value={task.depends_on.join(", ")} />
              )}
              {task.blocks.length > 0 && (
                <InfoRow label="블로킹" value={task.blocks.join(", ")} />
              )}
              {task.affected_files.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">영향 파일</div>
                  <div className="space-y-0.5">
                    {task.affected_files.map((f) => (
                      <div key={f} className="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
