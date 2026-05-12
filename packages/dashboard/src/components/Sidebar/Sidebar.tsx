"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTasksStore } from "@/store/tasksStore";
import { useDocTree } from "@/hooks/useDocTree";
import { useNoticeSummary } from "@/hooks/useNoticeSummary";
import {
  DocsSection,
  NoticesSection,
  SidebarFooter,
  TaskListSection,
} from "./components";
import useDocActions from "./hooks/useDocActions";

export interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const COLLAPSED_WIDTH = 48;

const Sidebar = ({ collapsed = false, onToggleCollapsed }: SidebarProps) => {
  const tasksSummary = useTasksStore((s) => s.tasksSummary);
  const stopTask = useTasksStore((s) => s.stopTask);
  const fetchTasksSummary = useTasksStore((s) => s.fetchTasksSummary);

  const { tree: docTree, createDoc, updateDoc, deleteDoc, reorderDoc, fetchTree } =
    useDocTree();
  const docActions = useDocActions({
    createDoc,
    deleteDoc,
    updateDoc,
    reorderDoc,
    fetchTree,
  });
  const { summary: noticeSummary } = useNoticeSummary();
  const pathname = usePathname();
  const currentPath = pathname ?? "/";

  const toggleLabel = collapsed ? "사이드바 펼치기" : "사이드바 접기";

  return (
    <div
      className="ide-sidebar flex flex-col h-full"
      style={collapsed ? { width: COLLAPSED_WIDTH } : undefined}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div
        className={cn(
          "flex items-center h-10 border-b border-sidebar-border shrink-0",
          collapsed ? "justify-center px-1" : "justify-between px-3",
        )}
      >
        {!collapsed && (
          <Link
            href="/"
            className="text-sm font-semibold text-sidebar-foreground no-underline hover:text-primary transition-colors"
          >
            Home
          </Link>
        )}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={toggleLabel}
            aria-expanded={!collapsed}
            title={toggleLabel}
            className="inline-flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:text-foreground hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      <div
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden py-2",
          collapsed ? "px-1" : "px-2",
        )}
        style={{ scrollbarWidth: "none" }}
      >
        <DocsSection
          docTree={docTree}
          currentPath={currentPath}
          docActions={docActions}
          collapsed={collapsed}
        />

        <TaskListSection
          summaryItems={tasksSummary.items}
          totalCount={tasksSummary.total}
          currentPath={currentPath}
          onStopTask={async (id) => {
            await stopTask(id);
            await fetchTasksSummary();
          }}
          collapsed={collapsed}
        />

        <NoticesSection
          noticeSummary={noticeSummary}
          currentPath={currentPath}
          collapsed={collapsed}
        />
      </div>
      <SidebarFooter currentPath={currentPath} collapsed={collapsed} />
    </div>
  );
};

export default Sidebar;
