"use client";

import { useState, useMemo } from "react";
import { useNotices } from "@/hooks/useNotices";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Info,
  AlertTriangle,
  AlertCircle,
  MessageSquare,
  Trash2,
  Check,
  Search,
} from "lucide-react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PageLayout, PageHeader } from "@/components/ui/page-layout";

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Info; dot: string; label: string; badge: string }
> = {
  info: {
    icon: Info,
    dot: "bg-blue-500",
    label: "Info",
    badge: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  },
  warning: {
    icon: AlertTriangle,
    dot: "bg-yellow-500",
    label: "Warning",
    badge: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  },
  error: {
    icon: AlertCircle,
    dot: "bg-red-500",
    label: "Error",
    badge: "bg-red-500/15 text-red-500 border-red-500/30",
  },
  request: {
    icon: MessageSquare,
    dot: "bg-violet-500",
    label: "Request",
    badge: "bg-violet-500/15 text-violet-500 border-violet-500/30",
  },
};

export default function NoticesPage() {
  const { notices, isLoading, error, updateNotice, deleteNotice } =
    useNotices();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = notices;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.id.toLowerCase().includes(q) ||
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== "all") {
      result = result.filter((n) => n.type === typeFilter);
    }
    return result;
  }, [notices, searchQuery, typeFilter]);

  if (isLoading)
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading notices...
      </div>
    );
  if (error) return <div className="p-4 text-sm text-red-500">{error}</div>;

  return (
    <PageLayout>
      <PageHeader title="Notices" />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          size="sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="검색..."
          className="pl-9 rounded-lg bg-muted/50 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Type Filter */}
      <div className="flex items-center gap-1">
        {(["all", "info", "warning", "error", "request"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={cn(
              "filter-pill text-[11px]",
              typeFilter === t &&
                (t === "all" ? "active" : TYPE_CONFIG[t]?.badge),
            )}
          >
            {t === "all" ? "All" : TYPE_CONFIG[t]?.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-1">
        {filtered.map((notice) => {
          const cfg = TYPE_CONFIG[notice.type] || TYPE_CONFIG.info;
          const Icon = cfg.icon;
          const isExpanded = expandedId === notice.id;

          return (
            <div
              key={notice.id}
              className={cn(
                "board-card",
                !notice.read && "border-l-2 border-l-primary",
              )}
            >
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={async () => {
                  setExpandedId(isExpanded ? null : notice.id);
                  if (!notice.read)
                    await updateNotice(notice.id, { read: true });
                }}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    notice.type === "error"
                      ? "text-red-500"
                      : notice.type === "warning"
                        ? "text-yellow-500"
                        : notice.type === "request"
                          ? "text-violet-500"
                          : "text-blue-500",
                  )}
                />
                <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                  {notice.id}
                </span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0",
                    cfg.badge,
                  )}
                >
                  {cfg.label}
                </span>
                <span
                  className={cn(
                    "text-sm flex-1 truncate text-left",
                    !notice.read && "font-medium",
                  )}
                >
                  {notice.title}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {notice.created}
                </span>
              </div>
              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="p-3" style={{ maxHeight: 300 }}>
                    {notice.content ? (
                      <MarkdownContent>{notice.content}</MarkdownContent>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        (No content)
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                    {!notice.read && (
                      <button
                        type="button"
                        onClick={() => updateNotice(notice.id, { read: true })}
                        className="filter-pill text-xs flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" />
                        Mark as read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`${notice.id} 삭제?`))
                          deleteNotice(notice.id);
                      }}
                      className="filter-pill text-xs flex items-center gap-1 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">알림이 없습니다.</p>
        </div>
      )}
    </PageLayout>
  );
}
