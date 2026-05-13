"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

export const SIDEBAR_COLLAPSED_W = 56;
export const SIDEBAR_EXPANDED_W = 220;

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const Sidebar = ({ collapsed, onToggleCollapsed }: SidebarProps) => {
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

  return (
    <div
      className="ide-sidebar flex flex-col h-full shrink-0 overflow-hidden transition-[width] duration-200"
      style={{ width: collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W }}
    >
      <div className="flex items-center px-2 h-10 border-b border-sidebar-border shrink-0">
        {!collapsed && (
          <Link
            href="/"
            className="flex-1 text-sm font-semibold text-sidebar-foreground no-underline hover:text-primary transition-colors"
          >
            Home
          </Link>
        )}
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapsed}
          className="p-1 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2"
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
          collapsed={collapsed}
          onStopTask={async (id) => {
            await stopTask(id);
            await fetchTasksSummary();
          }}
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
