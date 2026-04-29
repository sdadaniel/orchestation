import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { InputProps } from "./types";

const inputVariants = cva(
  "bg-muted border border-border rounded-md outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-foreground placeholder:text-muted-foreground",
  {
    variants: {
      size: {
        default: "w-full px-3 py-2.5 text-sm",
        sm: "w-full px-2.5 py-1.5 text-xs",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(inputVariants({ size, className }))}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input, inputVariants };
export type { InputProps } from "./types";
