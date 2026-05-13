"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoticesSectionProps } from "./types";

const NoticesSection = ({ noticeSummary, currentPath, collapsed }: NoticesSectionProps) => {
  const [noticesExpanded, setNoticesExpanded] = useState(true);

  const unreadNotices = useMemo(() => noticeSummary.items, [noticeSummary.items]);

  if (collapsed) {
    return (
      <div className="mb-2 flex justify-center">
        <Link
          href="/notices"
          aria-label="Notices"
          title="Notices"
          className={cn(
            "relative flex items-center justify-center w-8 h-8 rounded text-sidebar-foreground no-underline hover:bg-sidebar-accent transition-colors",
            currentPath === "/notices" && "active",
          )}
        >
          <Bell className="h-4 w-4" />
          {noticeSummary.unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold leading-none bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center">
              {noticeSummary.unreadCount > 9 ? "9+" : noticeSummary.unreadCount}
            </span>
          )}
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <div className="sidebar-section-sep" />
      <div className="px-2 mb-1.5 flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setNoticesExpanded((v) => !v)}
        >
          <span
            className={cn(
              "inline-block transition-transform duration-200",
              noticesExpanded ? "rotate-0" : "-rotate-90",
            )}
          >
            ▾
          </span>
          <Link
            href="/notices"
            className={cn(
              "no-underline text-muted-foreground hover:text-foreground transition-colors",
              currentPath === "/notices" && "text-primary",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            Notices
          </Link>
        </button>
        {unreadNotices.length > 0 ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold leading-tight">
            {noticeSummary.unreadCount}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">{noticeSummary.total}</span>
        )}
      </div>

      <div
        className={cn(
          "sidebar-collapsible",
          noticesExpanded && "sidebar-collapsible-open",
        )}
      >
        <div className="sidebar-collapsible-inner">
          {unreadNotices.map((notice) => (
            <Link
              key={notice.id}
              href="/notices"
              className="tree-item w-full text-left no-underline text-sidebar-foreground"
              title={notice.display_id ?? notice.id}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span className="truncate flex-1 text-xs font-medium">{notice.title}</span>
            </Link>
          ))}
          {noticeSummary.unreadCount === 0 && noticeSummary.total > 0 && (
            <div className="px-2 py-1 text-[11px] text-muted-foreground">All read</div>
          )}
          {noticeSummary.total === 0 && (
            <div className="px-2 py-1 text-[11px] text-muted-foreground">No notices</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoticesSection;
