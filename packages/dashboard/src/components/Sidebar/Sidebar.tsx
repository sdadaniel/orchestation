"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
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

  return (
    <div className="ide-sidebar flex flex-col h-full">
      <div className="flex items-center px-3 h-10 border-b border-sidebar-border shrink-0">
        <Link
          href="/"
          className="text-sm font-semibold text-sidebar-foreground no-underline hover:text-primary transition-colors"
        >
          Home
        </Link>
      </div>
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
      <SidebarFooter currentPath={currentPath} />
    </div>
  );
};

export default Sidebar;
