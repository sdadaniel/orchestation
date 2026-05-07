"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "sidebar-collapsed";

export function useSidebarCollapsed() {
  // SSR-safe: start with false (expanded), hydrate from localStorage after mount
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  return { collapsed, toggle };
}
