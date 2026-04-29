import type { DocNode } from "@/hooks/useDocTree";
import type { RequestItem } from "@/hooks/useRequests";

export type SearchResultItem = {
  type: "task" | "doc";
  id: string;
  displayId: string;
  title: string;
  status?: string;
  href: string;
};

export type GlobalSearchProps = {
  requestItems: RequestItem[];
  docTree: DocNode[];
};
