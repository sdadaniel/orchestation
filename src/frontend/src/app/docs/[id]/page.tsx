"use client";

import { use, useState, useCallback } from "react";
import { usePrds } from "@/hooks/usePrds";
import { BookOpen, Pencil, Eye, Save, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function DocsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { prds, isLoading } = usePrds();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedContent, setSavedContent] = useState<string | null>(null);

  const prd = prds.find((p) => p.id === id);
  const content = savedContent ?? prd?.content ?? "";

  const startEdit = useCallback(() => {
    setEditContent(content);
    setIsEditing(true);
  }, [content]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent("");
  }, []);

  const saveEdit = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/prds/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSavedContent(editContent);
      setIsEditing(false);
    } catch (err) {
      alert("저장 실패");
    } finally {
      setIsSaving(false);
    }
  }, [id, editContent]);

  if (isLoading) {
    return <div className="text-xs text-muted-foreground p-4">Loading...</div>;
  }

  if (!prd) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Document not found: {id}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="text-[11px] text-muted-foreground font-mono">{prd.id}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
          prd.status === "done" ? "bg-emerald-500/15 text-emerald-400" :
          prd.status === "in_progress" ? "bg-blue-500/15 text-blue-400" :
          "bg-zinc-500/15 text-zinc-400"
        }`}>
          {prd.status}
        </span>

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
            <button
              type="button"
              onClick={startEdit}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>
      </div>
      <h1 className="text-lg font-semibold mb-4">{prd.title}</h1>

      {/* Sprints */}
      {prd.sprints.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Sprints
          </div>
          <div className="flex flex-wrap gap-1">
            {prd.sprints.map((s) => (
              <span key={s} className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Document content */}
      <div className="border-t border-border pt-4">
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-[60vh] bg-muted border border-border rounded-md p-3 text-sm font-mono leading-relaxed resize-none outline-none focus:border-primary"
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
