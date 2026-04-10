"use client";

import { useState } from "react";
import type { RunHistoryEntry } from "@/hooks/useRunHistory";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "@/components/ui/select";
import { useSortableTable } from "./useSortableTable";
import { SortIcon } from "./SortIcon";
import { formatDuration } from "@/lib/format-utils";

interface RunHistoryProps {
  runs: RunHistoryEntry[];
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

type RunSortColumn =
  | "time"
  | "status"
  | "tasks"
  | "duration"
  | "cost"
  | "details";

const RUN_COMPARATORS: Record<
  RunSortColumn,
  (a: RunHistoryEntry, b: RunHistoryEntry) => number
> = {
  time: (a, b) => a.startedAt.localeCompare(b.startedAt),
  status: (a, b) => a.status.localeCompare(b.status),
  tasks: (a, b) =>
    a.tasksCompleted + a.tasksFailed - (b.tasksCompleted + b.tasksFailed),
  duration: (a, b) => a.totalDurationMs - b.totalDurationMs,
  cost: (a, b) => a.totalCostUsd - b.totalCostUsd,
  details: (a, b) => a.taskResults.length - b.taskResults.length,
};

export function RunHistory({ runs }: RunHistoryProps) {
  const { sorted, sort, toggleSort } = useSortableTable<
    RunHistoryEntry,
    RunSortColumn
  >(runs, "time", "desc", RUN_COMPARATORS);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  if (runs.length === 0) return null;

  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = sorted.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  function renderSortableHeader(
    key: RunSortColumn,
    label: string,
    align?: "right",
  ) {
    const isActive = sort.column === key;
    return (
      <th
        key={key}
        className={cn(
          "font-medium cursor-pointer select-none hover:text-foreground transition-colors",
          align === "right" && "text-right",
          isActive && "text-foreground",
        )}
        onClick={() => {
          toggleSort(key);
          setPage(1);
        }}
      >
        {label}
        <SortIcon active={isActive} direction={sort.direction} />
      </th>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto min-h-[50vh]">
        <table className="w-full text-xs compact-table">
          <thead>
            <tr className="border-b border-border text-left text-[10px] text-muted-foreground uppercase tracking-wider">
              {renderSortableHeader("time", "Time")}
              {renderSortableHeader("status", "Result")}
              {renderSortableHeader("tasks", "Tasks", "right")}
              {renderSortableHeader("duration", "Duration", "right")}
              {renderSortableHeader("cost", "Cost", "right")}
              {renderSortableHeader("details", "Details")}
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((run) => (
              <tr
                key={run.id}
                className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
              >
                <td className="font-mono text-muted-foreground">
                  {formatTimestamp(run.startedAt)}
                </td>
                <td>
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                      run.status === "completed"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400",
                    )}
                  >
                    {run.status === "completed" ? "Success" : "Failed"}
                  </span>
                </td>
                <td className="text-right font-mono">
                  <span className="text-emerald-400">{run.tasksCompleted}</span>
                  {run.tasksFailed > 0 && (
                    <>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-400">{run.tasksFailed}</span>
                    </>
                  )}
                </td>
                <td className="text-right font-mono">
                  {formatDuration(run.totalDurationMs)}
                </td>
                <td className="text-right font-mono">
                  ${run.totalCostUsd.toFixed(4)}
                </td>
                <td className="text-muted-foreground">
                  {run.taskResults.length > 0 && (
                    <span className="text-[10px]">
                      {run.taskResults.map((r) => r.taskId).join(", ")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">페이지당</span>
            <Select
              size="inline"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}개
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 || p === totalPages || Math.abs(p - safePage) <= 1,
              )
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                  acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span
                    key={`dots-${i}`}
                    className="px-1 text-[11px] text-muted-foreground"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p as number)}
                    className={cn(
                      "min-w-[28px] h-7 rounded text-[11px] font-medium transition-colors",
                      safePage === p
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {p}
                  </button>
                ),
              )}

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <span className="text-[11px] text-muted-foreground">
            {(safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, totalItems)} / {totalItems}
          </span>
        </div>
      )}
    </div>
  );
}
