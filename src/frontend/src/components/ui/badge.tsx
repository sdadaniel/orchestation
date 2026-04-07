import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { TaskStatus, TaskPriority } from "@/constants/status";
import { STATUS_STYLES, PRIORITY_STYLES } from "@/constants/theme";

const badgeVariants = cva("inline-flex items-center rounded font-medium", {
  variants: {
    size: {
      default: "px-1.5 py-0.5 text-[10px]",
      sm: "px-1 py-0.5 text-[9px]",
      md: "px-2 py-0.5 text-xs",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ size, className }))}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";

/* ── Semantic badges ── */

function StatusBadge({
  status,
  size,
  className,
  ...props
}: Omit<BadgeProps, "children"> & { status: TaskStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <Badge
      size={size}
      className={cn(style.bg, style.text ?? "text-white", "font-semibold", className)}
      {...props}
    >
      {style.label}
    </Badge>
  );
}
StatusBadge.displayName = "StatusBadge";

function PriorityBadge({
  priority,
  size,
  className,
  ...props
}: Omit<BadgeProps, "children"> & { priority: TaskPriority }) {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;
  return (
    <Badge
      size={size}
      className={cn(style.bg, style.text, "font-semibold", className)}
      {...props}
    >
      {style.label}
    </Badge>
  );
}
PriorityBadge.displayName = "PriorityBadge";

export { Badge, badgeVariants, StatusBadge, PriorityBadge };
