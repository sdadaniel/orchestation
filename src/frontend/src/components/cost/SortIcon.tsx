"use client";

import type { SortDirection } from "./useSortableTable";

interface SortIconProps {
  active: boolean;
  direction: SortDirection;
}

/**
 * Displays a sort direction indicator arrow.
 * Shows muted arrow when inactive, highlighted arrow when active.
 */
export function SortIcon({ active, direction }: SortIconProps) {
  return (
    <span
      className={`inline-block ml-0.5 text-[9px] ${
        active ? "text-foreground" : "text-muted-foreground/40"
      }`}
      aria-label={active ? (direction === "asc" ? "오름차순" : "내림차순") : "정렬 없음"}
    >
      {active ? (direction === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );
}
