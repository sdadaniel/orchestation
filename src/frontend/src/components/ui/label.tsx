import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const labelVariants = cva("font-medium text-muted-foreground", {
  variants: {
    size: {
      default: "text-sm",
      sm: "text-xs",
      section: "text-[11px] font-semibold uppercase tracking-[0.08em]",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export interface LabelProps
  extends
    React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelVariants> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(labelVariants({ size, className }))}
        {...props}
      />
    );
  },
);
Label.displayName = "Label";

export { Label, labelVariants };
