"use client";

import { useState } from "react";
import { useRequests, type RequestItem } from "@/hooks/useRequests";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import AutoImproveControl from "@/components/AutoImproveControl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { PageLayout, PageHeader } from "@/components/ui/page-layout";
import { RequestCard } from "./components";

const STATUS_DOT: Record<string, string> = {
  pending: "bg-yellow-500",
  in_progress: "bg-blue-500",
  reviewing: "bg-orange-500",
  done: "bg-emerald-500",
  rejected: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  reviewing: "Reviewing",
  done: "Done",
  rejected: "Rejected",
};

const STATUS_ORDER = [
  "pending",
  "reviewing",
  "in_progress",
  "rejected",
  "done",
];

export default function RequestsPageView() {
  const {
    requests,
    isLoading,
    error,
    createRequest,
    updateRequest,
    deleteRequest,
  } = useRequests();
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">(
    "medium",
  );

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createRequest(newTitle, newContent, newPriority);
    setNewTitle("");
    setNewContent("");
    setNewPriority("medium");
    setShowForm(false);
  };

  const grouped: Record<string, RequestItem[]> = {
    pending: requests.filter((r) => r.status === "pending"),
    reviewing: requests.filter((r) => r.status === "reviewing"),
    in_progress: requests.filter((r) => r.status === "in_progress"),
    rejected: requests.filter((r) => r.status === "rejected"),
    done: requests.filter((r) => r.status === "done"),
  };

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading tasks...</div>
    );
  }

  if (error) {
    return <div className="p-4 text-sm text-red-500">{error}</div>;
  }

  return (
    <PageLayout>
      <PageHeader title="Tasks">
        <AutoImproveControl />
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="filter-pill active flex items-center gap-1"
        >
          {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showForm ? "Cancel" : "New Task"}
        </button>
      </PageHeader>

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <Input
            type="text"
            placeholder="Task title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) handleCreate();
            }}
            autoFocus
          />
          <Textarea
            placeholder="Describe the task..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={4}
          />
          <div className="flex items-center gap-3">
            <Select
              value={newPriority}
              onChange={(e) =>
                setNewPriority(e.target.value as "high" | "medium" | "low")
              }
              size="sm"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newTitle.trim()}
              className={cn(
                "filter-pill",
                newTitle.trim() ? "active" : "opacity-50 cursor-not-allowed",
              )}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {STATUS_ORDER.map((status) => {
        const items = grouped[status];
        if (items.length === 0) return null;
        return (
          <div key={status}>
            <div className="flex items-center gap-2 mb-2">
              {status === "in_progress" ? (
                <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span
                  className={cn("w-2 h-2 rounded-full", STATUS_DOT[status])}
                />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {STATUS_LABEL[status]}
              </span>
              <span className="text-[10px] text-muted-foreground">
                ({items.length})
              </span>
            </div>
            <div className="space-y-1">
              {items.map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  onUpdate={updateRequest}
                  onDelete={deleteRequest}
                />
              ))}
            </div>
          </div>
        );
      })}

      {requests.length === 0 && !showForm && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">
            No tasks yet. Click "New Task" to create a task.
          </p>
        </div>
      )}
    </PageLayout>
  );
}
