"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type SprintProgressProps = {
  /** Sprint 이름 */
  title: string;
  /** 완료된 태스크 수 */
  done: number;
  /** 전체 태스크 수 */
  total: number;
  /** 접기/펼치기 상태를 외부에서 제어할 때 사용 */
  open?: boolean;
  /** 접기/펼치기 상태 변경 콜백 */
  onOpenChange?: (open: boolean) => void;
  /** Task 바 목록 (children) */
  children?: React.ReactNode;
  className?: string;
};

export function SprintProgress({
  title,
  done,
  total,
  open,
  onOpenChange,
  children,
  className,
}: SprintProgressProps) {
  const [internalOpen, setInternalOpen] = React.useState(true);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const handleOpenChange = isControlled
    ? onOpenChange
    : setInternalOpen;

  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={cn("rounded-lg border bg-card", className)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}

          <span className="font-semibold text-sm">{title}</span>

          <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
            {done}/{total} 완료
          </span>

          <Progress value={percentage} className="h-2 w-24 shrink-0" />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
