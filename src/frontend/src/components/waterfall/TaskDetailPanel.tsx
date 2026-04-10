"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { STATUS_STYLES, PRIORITY_STYLES } from "../../../lib/constants";
import type { WaterfallTask } from "@/types/waterfall";

type TaskDetailPanelProps = {
  task: WaterfallTask | null;
  onClose: () => void;
};

function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

function DetailSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function TaskIdList({ ids }: { ids: string[] }) {
  if (ids.length === 0) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <span
          key={id}
          className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs"
        >
          {id}
        </span>
      ))}
    </div>
  );
}

export function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const open = task !== null;

  const statusStyle = task ? STATUS_STYLES[task.status] : undefined;
  const priorityStyle = task
    ? (PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium)
    : undefined;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="overflow-y-auto">
        {task && (
          <>
            <SheetHeader>
              <SheetDescription className="font-mono text-xs">
                {task.id}
              </SheetDescription>
              <SheetTitle>{task.title}</SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {statusStyle && (
                  <Badge className={cn(statusStyle.bg, "text-white")}>
                    {statusStyle.label}
                  </Badge>
                )}
                {priorityStyle && (
                  <Badge className={cn(priorityStyle.bg, priorityStyle.text)}>
                    {priorityStyle.label}
                  </Badge>
                )}
              </div>

              <DetailSection label="Role">
                <span className="text-sm">{task.role || "-"}</span>
              </DetailSection>

              <DetailSection label="Depends On">
                <TaskIdList ids={task.depends_on} />
              </DetailSection>

              <DetailSection label="Blocks">
                <TaskIdList ids={task.blocks} />
              </DetailSection>

              <DetailSection label="Parallel With">
                <TaskIdList ids={task.parallel_with} />
              </DetailSection>

              <DetailSection label="Affected Files">
                {task.affected_files.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {task.affected_files.map((file) => (
                      <li
                        key={file}
                        className="truncate rounded-md bg-muted px-2 py-1 font-mono text-xs"
                      >
                        {file}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </DetailSection>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
