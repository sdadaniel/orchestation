"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { DayPicker } from "react-day-picker";
import { ko } from "react-day-picker/locale";
import { format } from "date-fns";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-day-picker/style.css";

interface DatePickerProps {
  value?: string; // yyyy-MM-dd or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "날짜 선택",
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected = value ? new Date(value + "T00:00:00") : undefined;

  const handleSelect = (day: Date | undefined) => {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 bg-muted border border-border rounded px-2 py-1 text-[11px] outline-none hover:border-primary/50 transition-colors",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <Calendar className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span>{value || placeholder}</span>
          {value && (
            <X
              className="h-3 w-3 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={handleClear}
            />
          )}
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 rounded-lg border border-border bg-card p-3 shadow-xl animate-in fade-in-0 zoom-in-95"
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            locale={ko}
            showOutsideDays
            classNames={{
              root: "text-foreground",
              months: "flex flex-col",
              month_caption: "flex justify-center items-center h-8 font-medium text-sm",
              nav: "flex items-center justify-between absolute inset-x-0 top-0 h-8 px-1",
              button_previous: "p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground",
              button_next: "p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground",
              weekdays: "flex",
              weekday: "w-8 text-center text-[11px] font-medium text-muted-foreground",
              week: "flex",
              day: "w-8 h-8 flex items-center justify-center text-xs rounded hover:bg-muted cursor-pointer transition-colors",
              day_button: "w-full h-full flex items-center justify-center rounded",
              selected: "bg-primary text-primary-foreground hover:bg-primary/90",
              today: "font-bold text-primary",
              outside: "text-muted-foreground/40",
              disabled: "text-muted-foreground/30 cursor-not-allowed",
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
