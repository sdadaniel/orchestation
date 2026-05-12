"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocTreeNode, NewItemInput } from "./index";
import { SidebarTooltip } from "./SidebarTooltip";
import type { DocsSectionProps } from "./types";

const DocsSection = ({
  docTree,
  currentPath,
  docActions,
  collapsed = false,
}: DocsSectionProps) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [docsExpanded, setDocsExpanded] = useState(false);
  const [newRootItemType, setNewRootItemType] = useState<"doc" | "folder" | null>(
    null,
  );
  const [showNewMenu, setShowNewMenu] = useState(false);

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreateRootItem = async (title: string) => {
    if (docActions?.create && newRootItemType) {
      await docActions.create(title, newRootItemType, null);
    }
    setNewRootItemType(null);
  };

  if (collapsed) {
    const docsActive = docTree.some(
      (n) => currentPath === `/docs/${n.id}` || currentPath.startsWith(`/docs/${n.id}/`),
    );
    return (
      <div className="mb-2 flex justify-center">
        <SidebarTooltip label={`Docs (${docTree.length})`}>
          <Link
            href="/"
            aria-label={`Docs (${docTree.length}건)`}
            className={cn(
              "tree-item justify-center w-8 h-8 p-0 text-sidebar-foreground no-underline",
              docsActive && "active",
            )}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </Link>
        </SidebarTooltip>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <div className="px-2 mb-1.5 flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setDocsExpanded((v) => !v)}
        >
          <span
            className={cn(
              "inline-block transition-transform duration-200",
              docsExpanded ? "rotate-0" : "-rotate-90",
            )}
          >
            ▾
          </span>
          Docs
        </button>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{docTree.length}</span>
          {docsExpanded && (
            <div className="relative">
              <button
                type="button"
                title="New document or folder"
                className="p-0.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewMenu(!showNewMenu)}
              >
                +
              </button>
              {showNewMenu && (
                <div className="absolute right-0 top-full mt-1 bg-sidebar border border-sidebar-border rounded shadow-lg z-50 py-1 min-w-[120px]">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1 text-xs hover:bg-sidebar-accent"
                    onClick={() => {
                      setNewRootItemType("doc");
                      setShowNewMenu(false);
                    }}
                  >
                    New Document
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1 text-xs hover:bg-sidebar-accent"
                    onClick={() => {
                      setNewRootItemType("folder");
                      setShowNewMenu(false);
                    }}
                  >
                    New Folder
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div
        className={cn("sidebar-collapsible", docsExpanded && "sidebar-collapsible-open")}
      >
        <div className="sidebar-collapsible-inner">
          {newRootItemType && (
            <NewItemInput
              type={newRootItemType}
              onConfirm={handleCreateRootItem}
              onCancel={() => setNewRootItemType(null)}
            />
          )}
          {docTree.map((node) => (
            <DocTreeNode
              key={node.id}
              node={node}
              depth={0}
              currentPath={currentPath}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              onDelete={docActions?.delete}
              onRename={docActions?.rename}
              onCreate={docActions?.create}
              onReorder={docActions?.reorder}
              onReorderError={docActions?.reorderError}
            />
          ))}
          {docTree.length === 0 && !newRootItemType && (
            <div className="px-2 py-2 text-[11px] text-muted-foreground">
              No documents yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocsSection;
