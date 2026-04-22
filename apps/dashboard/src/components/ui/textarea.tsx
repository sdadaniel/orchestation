import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

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

export interface TextareaProps
  extends
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

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
