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

const navItems: NavItem[] = [
  { label: "Terminal", icon: <SquareTerminal className="h-3.5 w-3.5" />, href: "/terminal" },
  { label: "Sprint", icon: <Calendar className="h-3.5 w-3.5" />, href: "/sprint" },
  { label: "Plan", icon: <FileText className="h-3.5 w-3.5" />, href: "/plan" },
  { label: "Cost", icon: <DollarSign className="h-3.5 w-3.5" />, href: "/cost" },
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
};

export function TaskSidebar({ groups, prds, filter, onFilterChange }: TaskSidebarProps) {
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
        <h1 className="text-sm font-semibold text-sidebar-foreground flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" />
          Tasks
        </h1>
      </div>

      {/* PRD → Sprint → Task tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* PRDs */}
        {prds.length > 0 && (
          <div className="mb-3">
            <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              PRD
            </div>

            {prds.map((prd) => {
              const isPrdExpanded = expandedPrds.has(prd.id);
              const isPrdActive = filter.type === "prd" && filter.prdId === prd.id;
              const prdSprints = groups.filter((g) => prd.sprints.includes(g.sprint.id));

              return (
                <div key={prd.id}>
                  <div
                    className={cn("tree-item", isPrdActive && "active")}
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
                  </div>

                  {isPrdExpanded && prdSprints.map((group) => {
                    const isSprintExpanded = expandedSprints.has(group.sprint.id);
                    const isSprintActive = filter.type === "sprint" && filter.sprintId === group.sprint.id;

                    return (
                      <div key={group.sprint.id} className="ml-4">
                        <div
                          className={cn("tree-item", isSprintActive && "active")}
                          onClick={() => onFilterChange({ type: "sprint", sprintId: group.sprint.id })}
                        >
                          <button
                            type="button"
                            className="shrink-0 p-0 bg-transparent border-none cursor-pointer text-muted-foreground"
                            onClick={(e) => { e.stopPropagation(); toggleSprint(group.sprint.id); }}
                          >
                            {isSprintExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </button>
                          <span className="truncate flex-1">{group.sprint.title}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {group.progress.done}/{group.progress.total}
                          </span>
                        </div>

                        {isSprintExpanded && group.tasks.length > 0 && (
                          <div className="ml-5 border-l border-sidebar-border">
                            {group.tasks.slice(0, 8).map((task) => (
                              <div
                                key={task.id}
                                className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-muted-foreground truncate"
                              >
                                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_STYLES[task.status as TaskStatus]?.dot ?? "bg-gray-400")} />
                                <span className="font-mono truncate">{task.id}</span>
                              </div>
                            ))}
                            {group.tasks.length > 8 && (
                              <div className="px-2 py-0.5 text-[10px] text-muted-foreground">+{group.tasks.length - 8} more</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Unlinked sprints (not in any PRD) */}
        {(() => {
          const linkedSprints = new Set(prds.flatMap((p) => p.sprints));
          const unlinked = groups.filter((g) => !linkedSprints.has(g.sprint.id));
          if (unlinked.length === 0) return null;

          return (
            <div className="mb-3">
              <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sprints
              </div>
              {unlinked.map((group) => {
                const isExpanded = expandedSprints.has(group.sprint.id);
                const isActive = filter.type === "sprint" && filter.sprintId === group.sprint.id;

                return (
                  <div key={group.sprint.id}>
                    <div className={cn("tree-item", isActive && "active")} onClick={() => onFilterChange({ type: "sprint", sprintId: group.sprint.id })}>
                      <button type="button" className="shrink-0 p-0 bg-transparent border-none cursor-pointer text-muted-foreground" onClick={(e) => { e.stopPropagation(); toggleSprint(group.sprint.id); }}>
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                      <span className="truncate flex-1">{group.sprint.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{group.progress.done}/{group.progress.total}</span>
                    </div>
                    {isExpanded && group.tasks.length > 0 && (
                      <div className="ml-5 border-l border-sidebar-border">
                        {group.tasks.slice(0, 8).map((task) => (
                          <div key={task.id} className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-muted-foreground truncate">
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_STYLES[task.status as TaskStatus]?.dot ?? "bg-gray-400")} />
                            <span className="font-mono truncate">{task.id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Divider */}
        <div className="border-t border-sidebar-border my-2" />

        {/* Filter sections */}
        <div>
          <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Filters
          </div>

          <div
            className={cn("tree-item", filter.type === "all" && "active")}
            onClick={() => onFilterChange({ type: "all" })}
          >
            <Layers className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="flex-1">All Tasks</span>
            <span className="text-[10px] text-muted-foreground">{totalTasks}</span>
          </div>

          <div className="px-2 mt-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
        </div>
      </div>

      {/* Bottom nav links to other pages */}
      <div className="border-t border-sidebar-border px-2 py-2">
        <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pages
        </div>
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="tree-item text-sidebar-foreground no-underline"
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Simple sidebar for non-Task pages ── */

export function PageSidebar() {
  const pathname = usePathname();

  const allNav: (NavItem & { isTask?: boolean })[] = [
    { label: "Task", icon: <ClipboardList className="h-3.5 w-3.5" />, href: "/", isTask: true },
    ...navItems,
  ];

  return (
    <aside className="flex h-screen w-48 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-3 py-3">
        <h1 className="text-sm font-semibold text-sidebar-foreground">Dashboard</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {allNav.map((item) => {
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
