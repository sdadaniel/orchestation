"use client";

import { useMemo, useState } from "react";
import type { CostEntry } from "@/parser/cost-parser";
import { useSortableTable } from "./useSortableTable";
import { SortIcon } from "./SortIcon";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "@/components/ui/select";
import Link from "next/link";
import { formatDurationMinutes } from "@/lib/format-utils";

interface CostTableProps {
  entries: CostEntry[];
}

type SortColumn = "taskId" | "phase" | "model" | "cost" | "time" | "turns" | "tokens" | "timestamp";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function formatTimestamp(raw: string): string {
  // raw format: "YYYY-MM-DD HH:MM:SS"
  if (!raw || raw.length < 10) return raw ?? "-";
  return raw; // Already in YYYY-MM-DD HH:mm:ss format
}


function getTotalTokens(entry: CostEntry): number {
  return entry.inputTokens + entry.outputTokens + entry.cacheCreate + entry.cacheRead;
}

const COMPARATORS: Record<SortColumn, (a: CostEntry, b: CostEntry) => number> = {
  taskId: (a, b) => a.taskId.localeCompare(b.taskId, undefined, { numeric: true }),
  phase: (a, b) => (a.phase ?? "").localeCompare(b.phase ?? ""),
  model: (a, b) => a.model.localeCompare(b.model),
  cost: (a, b) => a.costUsd - b.costUsd,
  time: (a, b) => a.durationMs - b.durationMs,
  turns: (a, b) => a.turns - b.turns,
  tokens: (a, b) => getTotalTokens(a) - getTotalTokens(b),
  timestamp: (a, b) => a.timestamp.localeCompare(b.timestamp),
};

export function CostTable({ entries }: CostTableProps) {
  const { sorted, sort, toggleSort } = useSortableTable<CostEntry, SortColumn>(
    entries,
    "timestamp",
    "desc",
    COMPARATORS,
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const maxCost = useMemo(() => {
    if (entries.length === 0) return 0;
    return Math.max(...entries.map((e) => e.costUsd));
  }, [entries]);

  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function renderSortableHeader(key: SortColumn, label: string, align?: "right") {
    const isActive = sort.column === key;
    return (
      <th
        key={key}
        className={cn(
          "font-medium cursor-pointer select-none hover:text-foreground transition-colors",
          align === "right" && "text-right",
          isActive && "text-foreground"
        )}
        onClick={() => { toggleSort(key); setPage(1); }}
        role="columnheader"
        aria-sort={isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <SortIcon active={isActive} direction={sort.direction} />
      </th>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto min-h-[50vh]">
        <table className="w-full text-xs compact-table table-fixed">
          <colgroup>
            <col className="w-[100px]" />
            <col className="w-[70px]" />
            <col className="w-[200px]" />
            <col className="w-[90px]" />
            <col className="w-[80px]" />
            <col className="w-[60px]" />
            <col className="w-[100px]" />
            <col className="w-[160px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-left text-[10px] text-muted-foreground uppercase tracking-wider">
              {renderSortableHeader("taskId", "Task ID")}
              {renderSortableHeader("phase", "Phase")}
              {renderSortableHeader("model", "Model")}
              {renderSortableHeader("cost", "Cost", "right")}
              {renderSortableHeader("time", "Time", "right")}
              {renderSortableHeader("turns", "Turns", "right")}
              {renderSortableHeader("tokens", "Tokens", "right")}
              {renderSortableHeader("timestamp", "시각", "right")}
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((entry, idx) => {
              const isHighest = entry.costUsd === maxCost && maxCost > 0;
              const totalTokens = getTotalTokens(entry);

              return (
                <tr
                  key={`${entry.taskId}-${entry.phase}-${entry.timestamp}-${idx}`}
                  className={cn(
                    "border-b border-border last:border-b-0 transition-colors",
                    isHighest
                      ? "bg-amber-500/10 text-amber-300 font-semibold"
                      : "hover:bg-muted/50"
                  )}
                >
                  <td>
                    <Link
                      href={`/tasks/${entry.taskId}`}
                      className={cn(
                        "font-mono hover:underline",
                        isHighest ? "text-amber-500" : "hover:text-foreground"
                      )}
                    >
                      {entry.taskId}
                    </Link>
                  </td>
                  <td>
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                        entry.phase === "task"
                          ? "bg-blue-500/15 text-blue-400"
                          : "bg-purple-500/15 text-purple-400"
                      )}
                    >
                      {entry.phase}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {entry.model}
                    </span>
                  </td>
                  <td className="text-right font-mono">
                    ${entry.costUsd.toFixed(4)}
                  </td>
                  <td className="text-right font-mono">
                    {formatDurationMinutes(entry.durationMs)}
                  </td>
                  <td className="text-right font-mono">
                    {entry.turns}
                  </td>
                  <td className="text-right font-mono">
                    {totalTokens.toLocaleString()}
                  </td>
                  <td className="text-right">
                    <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </td>
                </tr>
              );
            })}
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
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}개</option>
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
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`dots-${i}`} className="px-1 text-[11px] text-muted-foreground">...</span>
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
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalItems)} / {totalItems}
          </span>
        </div>
      )}
    </div>
  );
}
