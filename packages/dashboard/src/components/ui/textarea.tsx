import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { TextareaProps } from "./types";

const textareaVariants = cva(
  "bg-muted border border-border rounded-md outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-foreground placeholder:text-muted-foreground resize-y",
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

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(textareaVariants({ size, className }))}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea, textareaVariants };
export type { TextareaProps } from "./types";
