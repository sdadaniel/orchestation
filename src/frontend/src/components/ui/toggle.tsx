import * as React from "react";
import { cn } from "@/lib/utils";

export interface ToggleProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, checked = false, onChange, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200",
          checked ? "bg-primary" : "bg-border",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-foreground shadow-sm transition-transform duration-200",
            checked ? "translate-x-[15px]" : "translate-x-[1px]",
            checked && "bg-primary-foreground",
          )}
          style={{ marginTop: "1px" }}
        />
      </button>
    );
  },
);
Toggle.displayName = "Toggle";

export { Toggle };
