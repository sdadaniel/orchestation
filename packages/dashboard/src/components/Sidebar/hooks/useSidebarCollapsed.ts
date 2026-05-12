"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sidebar-collapsed";

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {
      // ignore storage errors (privacy mode etc.)
    }
    // Defer enabling transitions to the next frame so the initial
    // collapsed/expanded state snaps into place without animating
    // from the SSR default — prevents the flash that caused prior reverts.
    const id = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  return { collapsed, toggle, hydrated };
}
