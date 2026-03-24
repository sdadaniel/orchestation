"use client";

import { useEffect, useState, useCallback } from "react";

/* ── Types (client-side mirror of server types) ── */

export interface DocNode {
  id: string;
  title: string;
  type: "doc" | "folder";
  file?: string;
  children: DocNode[];
  readonly?: boolean;
}

export interface DocDetail {
  id: string;
  title: string;
  type: "doc" | "folder";
  file?: string;
  content: string;
  parentPath: string[];
  readonly?: boolean;
}

interface Manifest {
  tree: DocNode[];
}

export function useDocTree() {
  const [tree, setTree] = useState<DocNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch("/api/docs");
      if (!res.ok) throw new Error("Failed to fetch doc tree");
      const data: Manifest = await res.json();
      setTree(data.tree);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const createDoc = useCallback(
    async (title: string, type: "doc" | "folder", parentId?: string | null) => {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type, parentId: parentId || null }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const data = await res.json();
      await fetchTree();
      return data.node as DocNode;
    },
    [fetchTree],
  );

  const updateDoc = useCallback(
    async (id: string, updates: { title?: string; content?: string }) => {
      const res = await fetch(`/api/docs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update");
      await fetchTree();
    },
    [fetchTree],
  );

  const deleteDoc = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/docs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchTree();
    },
    [fetchTree],
  );

  const reorderDoc = useCallback(
    async (id: string, parentId: string | null, index?: number) => {
      const res = await fetch("/api/docs/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, parentId, index }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
      await fetchTree();
    },
    [fetchTree],
  );

  return { tree, isLoading, error, fetchTree, createDoc, updateDoc, deleteDoc, reorderDoc };
}

export function useDocDetail(id: string) {
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();
    let cancelled = false;

    const fetchDoc = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/docs/${id}`, {
          signal: abortController.signal,
        });
        if (cancelled) return;
        if (!res.ok) throw new Error("Document not found");
        const data: DocDetail = await res.json();
        if (cancelled) return;
        setDoc(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Error");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchDoc();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [id, fetchKey]);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  return { doc, isLoading, error, refetch };
}
