import * as React from "react";
import { cn } from "@/lib/utils";
import type { SliderProps } from "./types";

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className,
      value,
      onChange,
      min = 0,
      max = 100,
      showRange = true,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <div className="space-y-1">
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange?.(parseInt(e.target.value, 10))}
          disabled={disabled}
          className={cn(
            "ds-slider",
            disabled && "opacity-50 cursor-not-allowed",
            className,
          )}
          {...props}
        />
        {showRange && (
          <div className="flex justify-between text-[10px] text-muted-foreground/50">
            <span>{min}</span>
            <span>{max}</span>
          </div>
        )}
      </div>
    );
  },
);
Slider.displayName = "Slider";

export { Slider };
export type { SliderProps } from "./types";
