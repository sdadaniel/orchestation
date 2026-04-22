"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { DocNode, DocDetail } from "@/parser/doc-tree";
import { getErrorMessage } from "@/lib/error-utils";

export type { DocNode, DocDetail };

interface Manifest {
  tree: DocNode[];
}

async function fetchDocTree(): Promise<DocNode[]> {
  const res = await fetch("/api/docs");
  if (!res.ok) throw new Error("Failed to fetch doc tree");
  const data: Manifest = await res.json();
  return data.tree;
}

export function useDocTree() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.docs.tree();

  const {
    data: tree = [],
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: fetchDocTree,
    staleTime: 30_000,
  });

  // ── 생성
  const createMutation = useMutation({
    mutationFn: async (vars: {
      title: string;
      type: "doc" | "folder";
      parentId?: string | null;
    }) => {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: vars.title,
          type: vars.type,
          parentId: vars.parentId || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.all });
    },
  });

  // ── 수정
  const updateMutation = useMutation({
    mutationFn: async (vars: {
      id: string;
      updates: { title?: string; content?: string };
    }) => {
      const res = await fetch(`/api/docs/${vars.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars.updates),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.all });
    },
  });

  // ── 삭제
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/docs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.all });
    },
  });

  // ── 재정렬
  const reorderMutation = useMutation({
    mutationFn: async (vars: {
      id: string;
      parentId: string | null;
      index?: number;
    }) => {
      const res = await fetch("/api/docs/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error("Failed to reorder");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.all });
    },
  });

  const fetchTree = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.docs.all });

  return {
    tree,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    fetchTree,
    createDoc: async (
      title: string,
      type: "doc" | "folder",
      parentId?: string | null,
    ) => {
      const data = await createMutation.mutateAsync({ title, type, parentId });
      return data.node as DocNode;
    },
    updateDoc: (id: string, updates: { title?: string; content?: string }) =>
      updateMutation.mutateAsync({ id, updates }),
    deleteDoc: (id: string) => deleteMutation.mutateAsync(id),
    reorderDoc: (id: string, parentId: string | null, index?: number) =>
      reorderMutation.mutateAsync({ id, parentId, index }),
  };
}

async function fetchDocDetail(id: string): Promise<DocDetail> {
  const res = await fetch(`/api/docs/${id}`);
  if (!res.ok) throw new Error("Document not found");
  return res.json();
}

export function useDocDetail(id: string) {
  const queryClient = useQueryClient();

  const {
    data: doc = null,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.docs.detail(id),
    queryFn: () => fetchDocDetail(id),
    staleTime: 30_000,
    enabled: !!id,
  });

  return {
    doc,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.detail(id) }),
  };
}
