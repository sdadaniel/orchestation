"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/error-utils";

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

interface TaskLogTabProps {
  taskId: string;
  taskStatus: string;
}

const LEVEL_STYLES: Record<string, string> = {
  error: "text-red-400",
  warn: "text-yellow-400",
  info: "text-zinc-300",
};

const LEVEL_BADGE: Record<string, string> = {
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  warn: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const POLL_INTERVAL_MS = 5000;

export function TaskLogTab({ taskId, taskStatus }: TaskLogTabProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/logs`);
      if (res.status === 404) {
        setLogs((prev) => prev.length > 0 ? prev : []);
        setError(null);
        return;
      }
      if (!res.ok) {
        throw new Error("로그를 불러올 수 없습니다.");
      }
      const data: LogEntry[] = await res.json();
      if (!Array.isArray(data)) return;
      // 이미 로그가 있으면 빈 응답으로 덮어쓰지 않음 (일시적 파일 읽기 실패 방지)
      if (data.length === 0) {
        setLogs((prev) => prev.length > 0 ? prev : []);
        return;
      }
      setLogs(data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "알 수 없는 오류"));
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  // Initial fetch + polling for in_progress
  useEffect(() => {
    fetchLogs();

    if (taskStatus === "in_progress") {
      const interval = setInterval(fetchLogs, POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }
  }, [fetchLogs, taskStatus]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(isAtBottom);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">로그 불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-400 text-sm gap-2">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <FileText className="h-8 w-8 opacity-40" />
        <p className="text-sm">이 태스크에 대한 실행 로그가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-auto max-h-[500px] divide-y divide-border/50"
      >
        {logs.map((entry, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-3 px-4 py-2 text-xs hover:bg-muted/30 transition-colors",
              entry.level === "error" && "bg-red-500/5",
              entry.level === "warn" && "bg-yellow-500/5",
            )}
          >
            {/* Timestamp */}
            <span className="text-muted-foreground font-mono shrink-0 w-[140px]">
              {entry.timestamp}
            </span>
            {/* Level badge */}
            <span
              className={cn(
                "shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase w-[52px] text-center",
                LEVEL_BADGE[entry.level] || LEVEL_BADGE.info,
              )}
            >
              {entry.level}
            </span>
            {/* Message */}
            <span
              className={cn(
                "flex-1 whitespace-pre-wrap break-all font-mono",
                LEVEL_STYLES[entry.level] || LEVEL_STYLES.info,
              )}
            >
              {entry.message}
            </span>
          </div>
        ))}
      </div>

      {/* Polling indicator */}
      {taskStatus === "in_progress" && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-blue-500/5 text-blue-400 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          실시간 업데이트 중 ({POLL_INTERVAL_MS / 1000}초 간격)
        </div>
      )}
    </div>
  );
}
