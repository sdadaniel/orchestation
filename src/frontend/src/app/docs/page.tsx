"use client";

import { useDocTree, type DocNode } from "@/hooks/useDocTree";
import Link from "next/link";
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

function TreeNode({ node, depth = 0 }: { node: DocNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const isFolder = node.type === "folder";

  return (
    <div>
      {isFolder ? (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-muted transition-colors"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          {expanded ? (
            <FolderOpen className="h-4 w-4 text-blue-400 shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-blue-400 shrink-0" />
          )}
          <span className="text-sm font-medium text-foreground">{node.title}</span>
          <span className="text-[10px] text-muted-foreground ml-1">
            {node.children.length}
          </span>
        </button>
      ) : (
        <Link
          href={`/docs/${node.id}`}
          className={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted transition-colors no-underline",
          )}
          style={{ paddingLeft: `${depth * 16 + 8 + 18}px` }}
        >
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-foreground truncate">{node.title}</span>
        </Link>
      )}

      {isFolder && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocsPage() {
  const { tree, isLoading } = useDocTree();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-muted-foreground animate-pulse">Loading...</span>
      </div>
    );
  }

  const totalDocs = countDocs(tree);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold text-foreground">Documents</h1>
        <span className="text-[10px] text-muted-foreground">{totalDocs} documents</span>
      </div>

      <div className="rounded-lg border border-border bg-card p-2">
        {tree.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">No documents</p>
        ) : (
          tree.map((node) => <TreeNode key={node.id} node={node} />)
        )}
      </div>
    </div>
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
