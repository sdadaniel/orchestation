import { useRef, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequestItem } from "@/store/tasksStore";
import { PRIORITY_COLORS, STATUS_DOT } from "@/app/tasks/constants";
import { RequestCard } from "./RequestCard";

interface ChainGroupProps {
  items: RequestItem[];
  onUpdate: (
    id: string,
    updates: Partial<
      Pick<RequestItem, "status" | "title" | "content" | "priority">
    >,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder?: (id: string, direction: "up" | "down") => Promise<void>;
  isFirst?: boolean;
  isLast?: boolean;
}

export function ChainGroup({
  items,
  onUpdate,
  onDelete,
  onReorder,
  isFirst,
  isLast,
}: ChainGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const first = items[0];

  return (
    <div className="board-card">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-200",
            expanded && "rotate-90",
          )}
        />
        {first.status === "in_progress" ? (
          <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              STATUS_DOT[first.status],
            )}
          />
        )}
        <Link2 className="h-3 w-3 text-yellow-500 shrink-0" />
        <span className="font-mono text-[11px] text-muted-foreground shrink-0">
          {first.id}
        </span>
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0",
            PRIORITY_COLORS[first.priority],
          )}
        >
          {first.priority}
        </span>
        <span className="text-sm flex-1 truncate text-left">
          {first.title}{" "}
          <span className="text-muted-foreground text-xs">
            외 {items.length - 1}건
          </span>
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {items.reduce((latest, r) => {
            const d = r.updated || r.created;
            return d > latest ? d : latest;
          }, first.updated || first.created)}
        </span>
        {onReorder && (
          <div
            className="flex flex-col shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={isFirst}
              onClick={() => onReorder(first.id, "up")}
              className={cn(
                "p-0.5 rounded transition-colors",
                isFirst
                  ? "text-muted-foreground/30 cursor-default"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              disabled={isLast}
              onClick={() => onReorder(first.id, "down")}
              className={cn(
                "p-0.5 rounded transition-colors",
                isLast
                  ? "text-muted-foreground/30 cursor-default"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-200 ease-out"
        style={{ maxHeight: expanded ? "none" : 0, opacity: expanded ? 1 : 0 }}
      >
        <div className="mt-2 pt-2 border-t border-border space-y-1">
          {items.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              onUpdate={onUpdate}
              onDelete={onDelete}
              isFirst
              isLast
            />
          ))}
        </div>
      </div>
    </div>
  );
}
