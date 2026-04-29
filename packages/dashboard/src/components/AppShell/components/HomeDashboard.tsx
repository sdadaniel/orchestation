"use client";

import { useTasksStore } from "@/store/tasksStore";
import OverviewCard from "./OverviewCard";

const HomeDashboard = () => {
  const requestItems = useTasksStore((s) => s.requests);
  const inProgress = requestItems.filter((t) => t.status === "in_progress");
  const pending = requestItems.filter(
    (t) => t.status === "pending" || t.status === "reviewing",
  );
  const done = requestItems.filter((t) => t.status === "done");
  const failed = requestItems.filter((t) => t.status === "failed");
  const rejected = requestItems.filter((t) => t.status === "rejected");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold mb-3">Overview</h2>
        <div className="grid grid-cols-5 gap-3">
          <OverviewCard
            label="In Progress"
            count={inProgress.length}
            color="text-blue-500"
            href="/tasks?tab=in_progress"
          />
          <OverviewCard
            label="Pending"
            count={pending.length}
            color="text-yellow-500"
            href="/tasks?tab=pending"
          />
          <OverviewCard
            label="Done"
            count={done.length}
            color="text-emerald-500"
            href="/tasks?tab=done"
          />
          <OverviewCard
            label="Failed"
            count={failed.length}
            color="text-red-500"
            href="/tasks?tab=failed"
          />
          <OverviewCard
            label="Rejected"
            count={rejected.length}
            color="text-red-400"
            href="/tasks?tab=rejected"
          />
        </div>
      </div>

      {inProgress.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Active Tasks</h2>
          <div className="space-y-1">
            {inProgress.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2"
              >
                <span className="w-3 h-3 shrink-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                  {task.id}
                </span>
                <span className="text-sm flex-1 truncate">{task.title}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded text-blue-500 bg-blue-500/10">
                  In Progress
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Pending Tasks</h2>
          <div className="space-y-1">
            {pending.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full shrink-0 bg-yellow-500" />
                <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                  {task.id}
                </span>
                <span className="text-sm flex-1 truncate">{task.title}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded text-yellow-500 bg-yellow-500/10">
                  {task.status === "reviewing" ? "Reviewing" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {inProgress.length === 0 && pending.length === 0 && requestItems.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">All tasks completed.</p>
        </div>
      )}

      {requestItems.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No tasks yet. Create a new task from the sidebar.</p>
        </div>
      )}
    </div>
  );
};

export default HomeDashboard;
