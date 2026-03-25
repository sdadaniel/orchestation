"use client";

import { useMemo } from "react";
import type { CostEntry } from "@/lib/cost-parser";
import { useSortableTable } from "./useSortableTable";
import { SortIcon } from "./SortIcon";

const PAGE_SIZE = 20;

interface CostTableProps {
  entries: CostEntry[];
}

type SortColumn = "timestamp" | "cost" | "time" | "tokens";

function formatTimestamp(raw: string): string {
  // raw format: "YYYY-MM-DD HH:MM:SS"
  if (!raw || raw.length < 10) return raw ?? "-";
  return raw; // Already in YYYY-MM-DD HH:mm:ss format
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = Math.round(seconds % 60);
  return `${minutes}m ${remainSec}s`;
}

function getTotalTokens(entry: CostEntry): number {
  return entry.inputTokens + entry.outputTokens + entry.cacheCreate + entry.cacheRead;
}

const COMPARATORS: Record<SortColumn, (a: CostEntry, b: CostEntry) => number> = {
  timestamp: (a, b) => a.timestamp.localeCompare(b.timestamp),
  cost: (a, b) => a.costUsd - b.costUsd,
  time: (a, b) => a.durationMs - b.durationMs,
  tokens: (a, b) => getTotalTokens(a) - getTotalTokens(b),
};

const SORTABLE_HEADERS: { key: SortColumn; label: string; align?: "right" }[] = [
  { key: "timestamp", label: "시각" },
  { key: "cost", label: "Cost", align: "right" },
  { key: "time", label: "Time", align: "right" },
  { key: "tokens", label: "Tokens", align: "right" },
];

export function CostTable({ entries }: CostTableProps) {
  const { sorted, sort, toggleSort } = useSortableTable<CostEntry, SortColumn>(
    entries,
    "timestamp",
    "desc",
    COMPARATORS,
  );

  const maxCost = useMemo(() => {
    if (entries.length === 0) return 0;
    return Math.max(...entries.map((e) => e.costUsd));
  }, [entries]);

  function renderSortableHeader(key: SortColumn, label: string, align?: "right") {
    const isActive = sort.column === key;
    return (
      <th
        key={key}
        className={`font-medium cursor-pointer select-none hover:text-foreground transition-colors ${
          align === "right" ? "text-right" : ""
        } ${isActive ? "text-foreground" : ""}`}
        onClick={() => toggleSort(key)}
        role="columnheader"
        aria-sort={isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <SortIcon active={isActive} direction={sort.direction} />
      </th>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs compact-table">
        <thead>
          <tr className="border-b border-border text-left text-[10px] text-muted-foreground uppercase tracking-wider">
            {renderSortableHeader("timestamp", "시각")}
            <th className="font-medium">Task ID</th>
            <th className="font-medium">Phase</th>
            <th className="font-medium">Model</th>
            {renderSortableHeader("cost", "Cost", "right")}
            {renderSortableHeader("time", "Time", "right")}
            <th className="font-medium text-right">Turns</th>
            {renderSortableHeader("tokens", "Tokens", "right")}
          </tr>
        </thead>
        <tbody>
          {visible.map((entry, idx) => {
            const isHighest = entry.costUsd === maxCost && maxCost > 0;
            const totalTokens = getTotalTokens(entry);

            return (
              <tr
                key={`${entry.taskId}-${entry.phase}-${entry.timestamp}-${idx}`}
                className={`border-b border-border last:border-b-0 transition-colors ${
                  isHighest
                    ? "bg-amber-500/10 text-amber-300 font-semibold"
                    : "hover:bg-muted/50"
                }`}
              >
                <td>
                  <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </td>
                <td>
                  <span className={isHighest ? "text-amber-500" : "font-mono"}>
                    {entry.taskId}
                  </span>
                </td>
                <td>
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      entry.phase === "task"
                        ? "bg-blue-500/15 text-blue-400"
                        : "bg-purple-500/15 text-purple-400"
                    }`}
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
                  {formatDuration(entry.durationMs)}
                </td>
                <td className="text-right font-mono">
                  {entry.turns}
                </td>
                <td className="text-right font-mono">
                  {totalTokens.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-t border-border"
        >
          더보기 ({sorted.length - visibleCount}건 남음)
        </button>
      )}
    </div>
  );
}
