"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TabsItem<T extends string> = {
  key: T;
  label: string;
  icon?: LucideIcon;
};

type TabsProps<T extends string> = {
  items: TabsItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  className?: string;
};

export function Tabs<T extends string>({
  items,
  activeKey,
  onChange,
  className,
}: TabsProps<T>) {
  return (
    <div className={cn("flex items-center gap-1 border-b border-border", className)}>
      {items.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors",
            activeKey === tab.key
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.icon ? <tab.icon className="h-3 w-3" /> : null}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
