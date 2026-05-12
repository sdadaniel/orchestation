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
import { useSidebarCollapsed } from "./hooks/useSidebarCollapsed";

const COLLAPSED_WIDTH = 56;
const EXPANDED_WIDTH = 220;

const Sidebar = () => {
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
  const { collapsed, toggle } = useSidebarCollapsed();

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <div
      className={cn("ide-sidebar flex flex-col h-full", collapsed && "is-collapsed")}
      style={{ width, minWidth: width }}
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
        <button
          type="button"
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
          title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          aria-expanded={!collapsed}
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
