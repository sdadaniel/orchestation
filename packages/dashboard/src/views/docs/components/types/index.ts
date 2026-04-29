import type { DocNode } from "@/hooks/useDocTree";

export interface TreeNodeProps {
  node: DocNode;
  depth?: number;
}
