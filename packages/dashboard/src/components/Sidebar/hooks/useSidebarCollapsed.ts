"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "sidebar-collapsed";

let currentValue = false;
let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function loadFromStorage() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      currentValue = true;
      emit();
    }
  } catch {
    // ignore (private mode, etc.)
  }
}

function setValue(next: boolean) {
  if (currentValue === next) return;
  currentValue = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // ignore
  }
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => currentValue;
const getServerSnapshot = () => false;

export function useSidebarCollapsed() {
  useEffect(() => {
    loadFromStorage();
  }, []);

  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setCollapsed = useCallback((next: boolean) => setValue(next), []);
  const toggle = useCallback(() => setValue(!currentValue), []);

  return { collapsed, toggle, setCollapsed };
}
