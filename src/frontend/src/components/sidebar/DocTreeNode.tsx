"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Folder,
  FileText,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import type { DocNode } from "@/hooks/useDocTree";
import { InlineRename } from "./InlineRename";
import { NewItemInput } from "./NewItemInput";

/* ── Props ── */

export interface DocTreeNodeProps {
  node: DocNode;
  depth: number;
  currentPath: string;
  expandedFolders: Set<string>;
  toggleFolder: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onRename?: (id: string, title: string) => Promise<void>;
  onCreate?: (title: string, type: "doc" | "folder", parentId?: string | null) => Promise<void>;
  onReorder?: (nodeId: string, targetParentId: string | null, position: number) => Promise<void>;
  onReorderError?: (error: unknown) => void;
}

/* ── Component ── */

export function DocTreeNode({
  node,
  depth,
  currentPath,
  expandedFolders,
  toggleFolder,
  onDelete,
  onRename,
  onCreate,
  onReorder,
  onReorderError,
}: DocTreeNodeProps) {
  const { addToast } = useToast();
  const [isRenaming, setIsRenaming] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [newItemType, setNewItemType] = useState<"doc" | "folder" | null>(null);
  const [dragOver, setDragOver] = useState<"above" | "inside" | "below" | null>(null);
  const isFolder = node.type === "folder";
  const isExpanded = expandedFolders.has(node.id);
  const isActive = currentPath === `/docs/${node.id}`;

  const handleRename = async (title: string) => {
    if (onRename) await onRename(node.id, title);
    setIsRenaming(false);
  };

  const handleDelete = async () => {
    if (onDelete) await onDelete(node.id);
  };

  const handleCreateChild = async (title: string) => {
    if (onCreate && newItemType) {
      await onCreate(title, newItemType, node.id);
      if (!isExpanded) toggleFolder(node.id);
    }
    setNewItemType(null);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;

    if (isFolder && y > h * 0.25 && y < h * 0.75) {
      setDragOver("inside");
    } else if (y < h * 0.5) {
      setDragOver("above");
    } else {
      setDragOver("below");
    }
  };

  const handleDragLeave = () => setDragOver(null);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === node.id || !onReorder) {
      setDragOver(null);
      return;
    }

    try {
      if (dragOver === "inside" && isFolder) {
        await onReorder(draggedId, node.id, 0);
        if (!isExpanded) toggleFolder(node.id);
      } else if (dragOver === "above") {
        await onReorder(draggedId, node.id, -1);
      } else if (dragOver === "below") {
        await onReorder(draggedId, node.id, 1);
      }
    } catch (err) {
      addToast("문서 순서 변경에 실패했습니다.", "error");
      // Delegate to parent for state rollback/refetch
      onReorderError?.(err);
    } finally {
      setDragOver(null);
    }
  };

  const paddingLeft = 8 + depth * 12;

  const dropIndicator = dragOver === "above"
    ? "border-t-2 border-primary"
    : dragOver === "below"
    ? "border-b-2 border-primary"
    : dragOver === "inside"
    ? "bg-primary/20 ring-1 ring-primary/40 rounded"
    : "";

  return (
    <div>
      <div
        className={cn("relative group", dropIndicator)}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isFolder ? (
          <div
            className={cn("tree-item", isActive && "active")}
            style={{ paddingLeft }}
            onClick={() => toggleFolder(node.id)}
          >
            <button
              type="button"
              className="shrink-0 p-0 bg-transparent border-none cursor-pointer text-muted-foreground"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {isExpanded ? (
              <FolderOpen className="h-3 w-3 text-primary shrink-0" />
            ) : (
              <Folder className="h-3 w-3 text-primary shrink-0" />
            )}
            {isRenaming ? (
              <InlineRename
                initialValue={node.title}
                onConfirm={handleRename}
                onCancel={() => setIsRenaming(false)}
              />
            ) : (
              <span className="truncate flex-1 text-xs">{node.title}</span>
            )}
          </div>
        ) : (
          <Link
            href={`/docs/${node.id}`}
            className={cn("tree-item no-underline text-sidebar-foreground", isActive && "active")}
            style={{ paddingLeft }}
            draggable={false}
          >
            <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
            {isRenaming ? (
              <InlineRename
                initialValue={node.title}
                onConfirm={handleRename}
                onCancel={() => setIsRenaming(false)}
              />
            ) : (
              <span className="truncate flex-1 text-xs">{node.title}</span>
            )}
          </Link>
        )}

        {/* Hover actions — hide for readonly nodes */}
        {showActions && !isRenaming && !node.readonly && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-sidebar rounded px-0.5">
            {isFolder && (
              <>
                <button
                  type="button"
                  title="New document"
                  className="p-0.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); setNewItemType("doc"); if (!isExpanded) toggleFolder(node.id); }}
                >
                  <FileText className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  title="New folder"
                  className="p-0.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); setNewItemType("folder"); if (!isExpanded) toggleFolder(node.id); }}
                >
                  <Folder className="h-2.5 w-2.5" />
                </button>
              </>
            )}
            <button
              type="button"
              title="Rename"
              className="p-0.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIsRenaming(true); }}
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              title="Delete"
              className="p-0.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-red-400"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDelete(); }}
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {isFolder && isExpanded && (
        <div>
          {newItemType && (
            <div style={{ paddingLeft: paddingLeft + 12 }}>
              <NewItemInput
                type={newItemType}
                onConfirm={handleCreateChild}
                onCancel={() => setNewItemType(null)}
              />
            </div>
          )}
          {node.children.map((child) => (
            <DocTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              currentPath={currentPath}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              onDelete={onDelete}
              onRename={onRename}
              onCreate={onCreate}
              onReorder={onReorder}
              onReorderError={onReorderError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
