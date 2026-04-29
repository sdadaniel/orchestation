import { useCallback, useMemo } from "react";
import type { DocActions } from "../types";

type UseDocActionsParams = {
  createDoc: (
    title: string,
    type: "doc" | "folder",
    parentId?: string | null,
  ) => Promise<void>;
  deleteDoc: (id: string) => Promise<void>;
  updateDoc: (id: string, updates: { title?: string }) => Promise<void>;
  reorderDoc: (
    nodeId: string,
    targetParentId: string | null,
    position: number,
  ) => Promise<void>;
  fetchTree: () => Promise<void>;
};

const useDocActions = ({
  createDoc,
  deleteDoc,
  updateDoc,
  reorderDoc,
  fetchTree,
}: UseDocActionsParams): DocActions => {
  const create = useCallback<DocActions["create"]>(
    async (title, type, parentId) => {
      await createDoc(title, type, parentId);
    },
    [createDoc],
  );

  const remove = useCallback<DocActions["delete"]>(
    async (id) => {
      await deleteDoc(id);
    },
    [deleteDoc],
  );

  const rename = useCallback<DocActions["rename"]>(
    async (id, title) => {
      await updateDoc(id, { title });
    },
    [updateDoc],
  );

  const reorder = useCallback<DocActions["reorder"]>(
    async (nodeId, targetParentId, position) => {
      await reorderDoc(nodeId, targetParentId, position);
    },
    [reorderDoc],
  );

  const reorderError = useCallback<DocActions["reorderError"]>(
    async () => {
      await fetchTree();
    },
    [fetchTree],
  );

  return useMemo(
    () => ({
      create,
      delete: remove,
      rename,
      reorder,
      reorderError,
    }),
    [create, remove, rename, reorder, reorderError],
  );
};

export default useDocActions;
