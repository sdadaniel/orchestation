"use client";

import { use, useState, useCallback } from "react";
import { useDocDetail } from "@/hooks/useDocTree";
import { useRouter } from "next/navigation";
import { BookOpen, Pencil, Save, X, ChevronRight, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function DocsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { doc, isLoading, refetch } = useDocDetail(id);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const content = doc?.content ?? "";
  const title = doc?.title ?? "";

  const startEdit = useCallback(() => {
    setEditContent(content);
    setEditTitle(title);
    setIsEditing(true);
  }, [content, title]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent("");
    setEditTitle("");
  }, []);

  const saveEdit = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/docs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent, title: editTitle }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setIsEditing(false);
      await refetch();
    } catch {
      alert("저장 실패");
    } finally {
      setIsSaving(false);
    }
  }, [id, editContent, editTitle, refetch]);

  const saveTitle = useCallback(
    async (newTitle: string) => {
      try {
        const res = await fetch(`/api/docs/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
        if (!res.ok) throw new Error("Failed to save title");
        setIsEditingTitle(false);
        await refetch();
      } catch {
        alert("제목 저장 실패");
      }
    },
    [id, refetch],
  );

  if (isLoading) {
    return <div className="text-xs text-muted-foreground p-4">Loading...</div>;
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Document not found: {id}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-[500px]">
      {/* Breadcrumb — 항상 표시 */}
      <div className="flex items-center gap-1 mb-3 text-[11px]">
        <BookOpen className="h-3 w-3 text-primary shrink-0" />
        <span className="text-muted-foreground">Docs</span>
        {doc.parentPath.map((segment, i) => (
          <span
            key={i}
            className="flex items-center gap-1 text-muted-foreground"
          >
            <ChevronRight className="h-2.5 w-2.5" />
            <span>{segment}</span>
          </span>
        ))}
        <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
        <span className="text-foreground font-medium">{doc.title}</span>
        <span className="text-muted-foreground font-mono ml-1">({doc.id})</span>

        {/* Edit/View toggle */}
        <div className="ml-auto flex items-center gap-1">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={saveEdit}
                disabled={isSaving}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-3 w-3" />
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={startEdit}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm("이 문서를 삭제하시겠습니까?")) return;
                  const res = await fetch(`/api/docs/${id}`, {
                    method: "DELETE",
                  });
                  if (res.ok) router.push("/docs");
                  else alert("삭제 실패");
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Title - inline editable */}
      {isEditing ? (
        <Input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="text-lg font-semibold mb-4 px-2 py-1"
        />
      ) : isEditingTitle ? (
        <div className="mb-4">
          <Input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && editTitle.trim())
                saveTitle(editTitle.trim());
              if (e.key === "Escape") setIsEditingTitle(false);
            }}
            onBlur={() => {
              if (editTitle.trim() && editTitle.trim() !== title)
                saveTitle(editTitle.trim());
              else setIsEditingTitle(false);
            }}
            autoFocus
            className="text-lg font-semibold px-2 py-1 border-primary"
          />
        </div>
      ) : (
        <h1
          className="text-lg font-semibold mb-4 cursor-pointer hover:text-primary transition-colors"
          onClick={() => {
            setEditTitle(title);
            setIsEditingTitle(true);
          }}
          title="Click to rename"
        >
          {title || "Untitled"}
        </h1>
      )}

      {/* Document content */}
      <div className="border-t border-border pt-4">
        {isEditing ? (
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="h-[60vh] p-3 font-mono leading-relaxed resize-none"
            autoFocus
          />
        ) : (
          <div className="prose-custom">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content || "내용 없음"}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
