"use client";

import { cn } from "@/lib/utils";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import {
  type TaskStatus,
  type TaskPriority,
} from "../../lib/constants";
import type { WaterfallTask } from "@/types/waterfall";
import { MousePointerClick, BookOpen } from "lucide-react";
import type { Prd } from "@/hooks/usePrds";

type RightPanelProps = {
  task: WaterfallTask | null;
  prd: Prd | null;
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="detail-section">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function IdChip({ id }: { id: string }) {
  return (
    <span className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] mr-1 mb-1">
      {id}
    </span>
  );
}

export function RightPanel({ task, prd }: RightPanelProps) {
  // PRD 뷰 (태스크 미선택 + PRD 선택 시)
  if (!task && prd) {
    return (
      <div className="ide-right">
        <div className="px-3 py-3 border-b border-border">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
            <BookOpen className="h-3 w-3" />
            {prd.id}
          </div>
          <div className="text-sm font-semibold leading-tight">{prd.title}</div>
        </div>

        <Section label="Status">
          <span className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
            prd.status === "done" ? "bg-emerald-500/15 text-emerald-400" :
            prd.status === "in_progress" ? "bg-blue-500/15 text-blue-400" :
            "bg-zinc-500/15 text-zinc-400"
          )}>
            {prd.status}
          </span>
        </Section>

        <Section label="Sprints">
          {prd.sprints.length > 0 ? (
            <div className="flex flex-wrap">
              {prd.sprints.map((s) => <IdChip key={s} id={s} />)}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </Section>

        <Section label="Document">
          <div className="text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
            {prd.content || "내용 없음"}
          </div>
        </Section>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="ide-right flex flex-col items-center justify-center h-full text-muted-foreground">
        <MousePointerClick className="h-6 w-6 mb-2 opacity-40" />
        <p className="text-xs">Select a task or PRD</p>
      </div>
    );
  }

  return (
    <div className="ide-right">
      {/* Header */}
      <div className="px-3 py-3 border-b border-border">
        <div className="font-mono text-[11px] text-muted-foreground mb-1">{task.id}</div>
        <div className="text-sm font-semibold leading-tight">{task.title}</div>
      </div>

      {/* Status */}
      <Section label="Status">
        <StatusBadge status={task.status as TaskStatus} size="md" />
      </Section>

      {/* Priority */}
      <Section label="Priority">
        <PriorityBadge priority={task.priority as TaskPriority} size="md" />
      </Section>

      {/* Role */}
      <Section label="Role">
        <span className="text-sm">{task.role || "-"}</span>
      </Section>

      {/* Sprint */}
      <Section label="Sprint">
        <span className="text-sm">{task.sprint || "-"}</span>
      </Section>

      {/* Dependencies */}
      <Section label="Depends On">
        {task.depends_on.length > 0 ? (
          <div className="flex flex-wrap">
            {task.depends_on.map((id) => (
              <IdChip key={id} id={id} />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </Section>

      {/* Blocks */}
      <Section label="Blocks">
        {task.blocks.length > 0 ? (
          <div className="flex flex-wrap">
            {task.blocks.map((id) => (
              <IdChip key={id} id={id} />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </Section>

      {/* Parallel With */}
      <Section label="Parallel With">
        {task.parallel_with.length > 0 ? (
          <div className="flex flex-wrap">
            {task.parallel_with.map((id) => (
              <IdChip key={id} id={id} />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </Section>

      {/* Affected Files */}
      <Section label="Files">
        {task.affected_files.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {task.affected_files.map((file) => (
              <div
                key={file}
                className="truncate rounded bg-muted px-2 py-0.5 font-mono text-[11px]"
              >
                {file}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </Section>
    </div>
  );
}
