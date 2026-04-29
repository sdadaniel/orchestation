export type DocActions = {
  create: (
    title: string,
    type: "doc" | "folder",
    parentId?: string | null,
  ) => Promise<void>;
  delete: (id: string) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  reorder: (
    nodeId: string,
    targetParentId: string | null,
    position: number,
  ) => Promise<void>;
  reorderError: (error: unknown) => void | Promise<void>;
};
