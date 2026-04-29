"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTasksStore } from "@/store/tasksStore";
import { useDocTree } from "@/hooks/useDocTree";
import { useNotices } from "@/hooks/useNotices";
import {
  DocsSection,
  NoticesSection,
  SidebarFooter,
  TaskListSection,
} from "./components";
import useDocActions from "./hooks/useDocActions";

const Sidebar = () => {
  const requestItems = useTasksStore((s) => s.requests);
  const handleStopTask = useTasksStore((s) => s.stopTask);
  const { tree: docTree, createDoc, updateDoc, deleteDoc, reorderDoc, fetchTree } =
    useDocTree();
  const docActions = useDocActions({
    createDoc,
    deleteDoc,
    updateDoc,
    reorderDoc,
    fetchTree,
  });
  const { notices: storeNotices } = useNotices();
  const pathname = usePathname();
  const noticeItems = storeNotices ?? [];
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
          requestItems={requestItems}
          currentPath={currentPath}
          onStopTask={handleStopTask}
        />

        <NoticesSection noticeItems={noticeItems} currentPath={currentPath} />
      </div>
      <SidebarFooter currentPath={currentPath} />
    </div>
  );
};

export default Sidebar;
