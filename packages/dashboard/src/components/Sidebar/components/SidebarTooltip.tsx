"use client";

import type { ReactNode } from "react";

interface SidebarTooltipProps {
  label: string;
  show?: boolean;
  children: ReactNode;
}

export function SidebarTooltip({ label, show = true, children }: SidebarTooltipProps) {
  if (!show) return <>{children}</>;
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded border border-border bg-popover px-2 py-1 text-[11px] text-popover-foreground opacity-0 shadow transition-opacity duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

export default SidebarTooltip;
