"use client";

import { useState, useMemo, useCallback } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  column: K;
  direction: SortDirection;
}

/**
 * Generic hook for sortable table columns.
 * Returns sorted data and a toggle handler.
 */
export function useSortableTable<T, K extends string>(
  data: T[],
  defaultColumn: K,
  defaultDirection: SortDirection,
  comparators: Record<K, (a: T, b: T) => number>,
) {
  const [sort, setSort] = useState<SortState<K>>({
    column: defaultColumn,
    direction: defaultDirection,
  });

  const toggleSort = useCallback((column: K) => {
    setSort((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { column, direction: "desc" };
    });
  }, []);

  const sorted = useMemo(() => {
    const comparator = comparators[sort.column];
    if (!comparator) return [...data];
    const multiplier = sort.direction === "asc" ? 1 : -1;
    return [...data].sort((a, b) => comparator(a, b) * multiplier);
  }, [data, sort.column, sort.direction, comparators]);

  return { sorted, sort, toggleSort } as const;
}
