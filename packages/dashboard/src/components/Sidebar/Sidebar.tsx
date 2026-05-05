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

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const Sidebar = ({ collapsed = false, onToggle }: SidebarProps) => {
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
      className="ide-sidebar flex flex-col h-full transition-all duration-300 ease-in-out"
      style={{
        width: collapsed ? "50px" : "240px",
      }}
    >
      {/* Header with toggle button */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-sidebar-border shrink-0">
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
          onClick={onToggle}
          className="p-1 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={collapsed ? "展开侧边栏" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Content area - hidden when collapsed */}
      {!collapsed && (
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2"
          style={{ scrollbarWidth: "none" }}
        >
          <DocsSection
            docTree={docTree}
            currentPath={currentPath}
            docActions={docActions}
          />

          <TaskListSection
            summaryItems={tasksSummary.items}
            totalCount={tasksSummary.total}
            currentPath={currentPath}
            onStopTask={async (id) => {
              await stopTask(id);
              await fetchTasksSummary();
            }}
          />

          <NoticesSection noticeSummary={noticeSummary} currentPath={currentPath} />
        </div>
      )}

      {!collapsed && <SidebarFooter currentPath={currentPath} />}
    </div>
  );
};

export default Sidebar;
