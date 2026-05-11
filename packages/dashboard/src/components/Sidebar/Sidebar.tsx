"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { PanelLeft, Home, FileText, ListTodo, Bell } from "lucide-react";
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

const EXPANDED_WIDTH = 220;
const COLLAPSED_WIDTH = 52;

interface CollapsedNavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  badge?: number;
}

function CollapsedNavItem({
  href,
  icon,
  label,
  isActive,
  badge,
}: CollapsedNavItemProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-md transition-colors relative no-underline",
        "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
        isActive && "bg-sidebar-accent text-primary",
      )}
    >
      {icon}
      {badge != null && badge > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold leading-none"
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}

const Sidebar = () => {
  const { collapsed, toggle } = useSidebarCollapsed();
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
      className="ide-sidebar flex flex-col h-full transition-all duration-200 ease-in-out"
      style={{
        width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        minWidth: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        maxWidth: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
      }}
      aria-expanded={!collapsed}
    >
      <div
        className={cn(
          "flex items-center h-10 border-b border-sidebar-border shrink-0 gap-1",
          collapsed ? "px-1.5 justify-center" : "px-2",
        )}
      >
        {collapsed ? (
          <Link
            href="/"
            aria-label="Home"
            title="Home"
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md transition-colors no-underline",
              "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
              currentPath === "/" && "bg-sidebar-accent text-primary",
            )}
          >
            <Home className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            href="/"
            className="flex-1 text-sm font-semibold text-sidebar-foreground no-underline hover:text-primary transition-colors px-1 truncate"
          >
            Home
          </Link>
        )}
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-md transition-colors shrink-0",
            "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
        >
          <PanelLeft
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              collapsed && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      </div>

      {collapsed ? (
        <div
          className="flex-1 flex flex-col items-center gap-1 py-2 overflow-y-auto overflow-x-hidden"
          style={{ scrollbarWidth: "none" }}
        >
          <CollapsedNavItem
            href="/docs"
            icon={<FileText className="h-4 w-4" />}
            label="Docs"
            isActive={currentPath.startsWith("/docs")}
          />
          <CollapsedNavItem
            href="/tasks"
            icon={<ListTodo className="h-4 w-4" />}
            label="Tasks"
            isActive={currentPath.startsWith("/tasks")}
            badge={
              tasksSummary.active.length > 0
                ? tasksSummary.active.length
                : undefined
            }
          />
          <CollapsedNavItem
            href="/notices"
            icon={<Bell className="h-4 w-4" />}
            label="Notices"
            isActive={currentPath === "/notices"}
            badge={
              noticeSummary.unreadCount > 0 ? noticeSummary.unreadCount : undefined
            }
          />
        </div>
      ) : (
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

      <SidebarFooter currentPath={currentPath} collapsed={collapsed} />
    </div>
  );
};

export default Sidebar;
