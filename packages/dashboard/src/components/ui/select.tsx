import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const selectVariants = cva(
  "bg-muted border border-border rounded-md outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-foreground appearance-none cursor-pointer",
  {
    variants: {
      size: {
        default: "w-full px-3 py-2.5 pr-8 text-sm",
        sm: "w-full px-2.5 py-1.5 pr-7 text-xs",
        inline: "px-2 py-0.5 pr-6 text-xs",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export interface SelectProps
  extends
    Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">,
    VariantProps<typeof selectVariants> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(selectVariants({ size, className }))}
          {...props}
        />
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select, selectVariants };
