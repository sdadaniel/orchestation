"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NoticesSectionProps } from "./types";

const NoticesSection = ({ noticeItems, currentPath }: NoticesSectionProps) => {
  const [noticesExpanded, setNoticesExpanded] = useState(true);

  const unreadNotices = useMemo(
    () => noticeItems.filter((notice) => !notice.read),
    [noticeItems],
  );

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
            {unreadNotices.length}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">{noticeItems.length}</span>
        )}
      </div>

      <div
        className={cn(
          "sidebar-collapsible",
          noticesExpanded && "sidebar-collapsible-open",
        )}
      >
        <div className="sidebar-collapsible-inner">
          {unreadNotices.slice(0, 5).map((notice) => (
            <Link
              key={notice.id}
              href="/notices"
              className="tree-item w-full text-left no-underline text-sidebar-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span className="truncate flex-1 text-xs font-medium">{notice.title}</span>
            </Link>
          ))}
          {unreadNotices.length === 0 && noticeItems.length > 0 && (
            <div className="px-2 py-1 text-[11px] text-muted-foreground">All read</div>
          )}
          {noticeItems.length === 0 && (
            <div className="px-2 py-1 text-[11px] text-muted-foreground">No notices</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoticesSection;
