"use client";

import { useDocTree, type DocNode } from "@/hooks/useDocTree";
import { PageLayout, PageHeader } from "@/components/ui/page-layout";
import { TreeNode } from "./components";

export default function DocsPageView() {
  const { tree, isLoading } = useDocTree();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-muted-foreground animate-pulse">
          Loading...
        </span>
      </div>
    );
  }

  const totalDocs = countDocs(tree);

  return (
    <PageLayout>
      <PageHeader title="Documents" />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {totalDocs} documents
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card p-2">
        {tree.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">
            No documents
          </p>
        ) : (
          tree.map((node) => <TreeNode key={node.id} node={node} />)
        )}
      </div>
    </PageLayout>
  );
}

function countDocs(nodes: DocNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (n.type === "doc") count++;
    count += countDocs(n.children);
  }
  return count;
}
