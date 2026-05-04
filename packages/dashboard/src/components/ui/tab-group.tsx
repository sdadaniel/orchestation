"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TabGroupContextValue = {
  value: string;
  onValueChange: (next: string) => void;
  idPrefix: string;
};

const TabGroupContext = React.createContext<TabGroupContextValue | null>(null);

const useTabGroup = (label: string) => {
  const ctx = React.useContext(TabGroupContext);
  if (!ctx) {
    throw new Error(`${label} must be used within TabGroup`);
  }
  return ctx;
};

export type TabGroupProps<T extends string = string> = {
  value: T;
  onValueChange: (next: T) => void;
  children: React.ReactNode;
  className?: string;
};

const TabGroup = <T extends string>({
  value,
  onValueChange,
  children,
  className,
}: TabGroupProps<T>) => {
  const idPrefix = React.useId();

  const ctx = React.useMemo<TabGroupContextValue>(
    () => ({
      value,
      onValueChange: (next) => onValueChange(next as T),
      idPrefix,
    }),
    [idPrefix, onValueChange, value],
  );

  return (
    <TabGroupContext.Provider value={ctx}>
      <div className={cn("space-y-4", className)}>{children}</div>
    </TabGroupContext.Provider>
  );
};

export type TabListProps = {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
};

const TabList = ({ children, className, "aria-label": ariaLabel }: TabListProps) => {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex items-center gap-1 border-b border-border", className)}
    >
      {children}
    </div>
  );
};

export type TabTone = "default" | "highlight";

export type TabProps<T extends string = string> = {
  value: T;
  children: React.ReactNode;
  icon?: LucideIcon;
  /** `highlight`: active tab uses accent (e.g. suggest / AI). */
  tone?: TabTone;
  className?: string;
};

const Tab = <T extends string>({
  value,
  children,
  icon: Icon,
  tone = "default",
  className,
}: TabProps<T>) => {
  const { value: selected, onValueChange, idPrefix } = useTabGroup("Tab");
  const isSelected = selected === value;
  const tabId = `${idPrefix}-tab-${value}`;
  const panelId = `${idPrefix}-panel-${value}`;

  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      tabIndex={isSelected ? 0 : -1}
      aria-selected={isSelected}
      aria-controls={panelId}
      onClick={() => onValueChange(value)}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors",
        isSelected && tone === "highlight"
          ? "border-yellow-400 text-yellow-400"
          : isSelected
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {children}
    </button>
  );
};

export type TabPanelProps<T extends string = string> = {
  value: T;
  children: React.ReactNode;
  className?: string;
};

const TabPanel = <T extends string>({
  value,
  children,
  className,
}: TabPanelProps<T>) => {
  const { value: selected, idPrefix } = useTabGroup("TabPanel");
  const isSelected = selected === value;
  const tabId = `${idPrefix}-tab-${value}`;
  const panelId = `${idPrefix}-panel-${value}`;

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      hidden={!isSelected}
      className={className}
    >
      {isSelected ? children : null}
    </div>
  );
};

export { TabGroup, TabList, Tab, TabPanel };
