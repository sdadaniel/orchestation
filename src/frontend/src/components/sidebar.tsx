"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Calendar,
  DollarSign,
  FileText,
  SquareTerminal,
  Layers,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WaterfallGroup } from "@/types/waterfall";
import {
  STATUS_STYLES,
  type TaskStatus,
} from "../../lib/constants";

/* ── Types ── */

export type SidebarFilter =
  | { type: "all" }
  | { type: "prd"; prdId: string }
  | { type: "sprint"; sprintId: string }
  | { type: "status"; status: TaskStatus };

type NavItem = {
  label: string;
  icon: React.ReactNode;
  href: string;
};

const pageNavItems: NavItem[] = [
  { label: "Task", icon: <ClipboardList className="h-3.5 w-3.5" />, href: "/" },
  { label: "Sprint", icon: <Calendar className="h-3.5 w-3.5" />, href: "/sprint" },
  { label: "Plan", icon: <FileText className="h-3.5 w-3.5" />, href: "/plan" },
  { label: "Cost", icon: <DollarSign className="h-3.5 w-3.5" />, href: "/cost" },
  { label: "Terminal", icon: <SquareTerminal className="h-3.5 w-3.5" />, href: "/terminal" },
];

/* ── Sidebar for IDE Task page ── */

export interface PrdInfo {
  id: string;
  title: string;
  status: string;
  sprints: string[];
}

type TaskSidebarProps = {
  groups: WaterfallGroup[];
  prds: PrdInfo[];
  filter: SidebarFilter;
  onFilterChange: (filter: SidebarFilter) => void;
  currentPath?: string;
};

export function TaskSidebar({ groups, prds, filter, onFilterChange, currentPath = "/" }: TaskSidebarProps) {
  const [expandedPrds, setExpandedPrds] = useState<Set<string>>(
    () => new Set(prds.map((p) => p.id)),
  );
  const [expandedSprints, setExpandedSprints] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.sprint.id)),
  );

  const togglePrd = (id: string) => {
    setExpandedPrds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSprint = (id: string) => {
    setExpandedSprints((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalTasks = groups.reduce((sum, g) => sum + g.tasks.length, 0);

  const statuses: TaskStatus[] = ["backlog", "in_progress", "in_review", "done"];

  // Count tasks per status across all groups
  const statusCounts: Record<string, number> = {};
  for (const s of statuses) statusCounts[s] = 0;
  for (const g of groups) {
    for (const t of g.tasks) {
      if (statusCounts[t.status] !== undefined) statusCounts[t.status]++;
    }
  }

  return (
    <div className="ide-sidebar flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-sidebar-border">
        <Link href="/" className="text-sm font-semibold text-sidebar-foreground no-underline hover:text-primary transition-colors">
          Dashboard
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">

        {/* ── Docs (기획 문서) ── */}
        {prds.length > 0 && (
          <div className="mb-2">
            <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Docs
            </div>
            {prds.map((prd) => {
              const isPrdExpanded = expandedPrds.has(prd.id);
              const isPrdActive = currentPath === `/docs/${prd.id}`;

              return (
                <div key={prd.id}>
                  <Link
                    href={`/docs/${prd.id}`}
                    className={cn("tree-item no-underline text-sidebar-foreground", isPrdActive && "active")}
                    onClick={() => onFilterChange({ type: "prd", prdId: prd.id })}
                  >
                    <button
                      type="button"
                      className="shrink-0 p-0 bg-transparent border-none cursor-pointer text-muted-foreground"
                      onClick={(e) => { e.stopPropagation(); togglePrd(prd.id); }}
                    >
                      {isPrdExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                    <BookOpen className="h-3 w-3 text-primary shrink-0" />
                    <span className="truncate flex-1">{prd.title}</span>
                  </Link>

                  {/* Plan은 PRD 하위 */}
                  {isPrdExpanded && (
                    <div className="ml-5 border-l border-sidebar-border">
                      <Link href="/plan" className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-muted-foreground no-underline hover:text-foreground">
                        <FileText className="h-2.5 w-2.5 shrink-0" />
                        Plan
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Sprints (일정) ── */}
        <div className="mb-2">
          <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sprints
          </div>
          {groups.map((group) => {
            const isActive = currentPath === `/sprint/${group.sprint.id}`;
            return (
              <Link
                key={group.sprint.id}
                href={`/sprint/${group.sprint.id}`}
                className={cn("tree-item no-underline text-sidebar-foreground", isActive && "active")}
              >
                <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{group.sprint.title}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {group.progress.done}/{group.progress.total}
                </span>
              </Link>
            );
          })}
        </div>

        {/* ── Tasks (작업) ── */}
        <div className="mb-2">
          <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tasks
          </div>

          <Link
            href="/"
            className={cn("tree-item no-underline text-sidebar-foreground", filter.type === "all" && currentPath === "/" && "active")}
            onClick={() => onFilterChange({ type: "all" })}
          >
            <Layers className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="flex-1">All Tasks</span>
            <span className="text-[10px] text-muted-foreground">{totalTasks}</span>
          </Link>

          <div className="px-2 mt-1.5 mb-0.5 text-[10px] text-muted-foreground">
            By Status
          </div>
          {statuses.map((status) => {
            const style = STATUS_STYLES[status];
            const isActive = filter.type === "status" && filter.status === status;
            return (
              <div
                key={status}
                className={cn("tree-item", isActive && "active")}
                onClick={() => onFilterChange({ type: "status", status })}
              >
                <span className={cn("w-2 h-2 rounded-full shrink-0", style.dot)} />
                <span className="flex-1">{style.label}</span>
                <span className="text-[10px] text-muted-foreground">{statusCounts[status]}</span>
              </div>
            );
          })}

          <div className="px-2 mt-1.5 mb-0.5 text-[10px] text-muted-foreground">
            By Sprint
          </div>
          {groups.map((group) => {
            const isActive = filter.type === "sprint" && filter.sprintId === group.sprint.id;
            return (
              <div
                key={`filter-${group.sprint.id}`}
                className={cn("tree-item", isActive && "active")}
                onClick={() => onFilterChange({ type: "sprint", sprintId: group.sprint.id })}
              >
                <span className="w-2 h-2 shrink-0" />
                <span className="flex-1 truncate">{group.sprint.title}</span>
                <span className="text-[10px] text-muted-foreground">{group.progress.done}/{group.progress.total}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom: Cost + Terminal */}
      <div className="border-t border-sidebar-border px-2 py-2">
        <Link href="/cost" className={cn("tree-item text-sidebar-foreground no-underline", currentPath === "/cost" && "active")}>
          <DollarSign className="h-3.5 w-3.5" />
          <span>Cost</span>
        </Link>
        <Link href="/terminal" className={cn("tree-item text-sidebar-foreground no-underline", currentPath === "/terminal" && "active")}>
          <SquareTerminal className="h-3.5 w-3.5" />
          <span>Terminal</span>
        </Link>
      </div>
    </div>
  );
}

/* ── Simple sidebar for non-Task pages ── */

export function PageSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-48 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-3 py-3">
        <h1 className="text-sm font-semibold text-sidebar-foreground">Dashboard</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {pageNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "tree-item text-sidebar-foreground no-underline",
                isActive && "active",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
