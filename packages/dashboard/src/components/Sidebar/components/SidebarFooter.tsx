"use client";

import Link from "next/link";
import { DollarSign, SquareTerminal, Settings, Activity, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarTooltip } from "./SidebarTooltip";
import type { SidebarFooterProps } from "./types";

const FOOTER_ITEMS = [
  { href: "/cost", icon: DollarSign, label: "Cost" },
  { href: "/log", icon: Activity, label: "Log" },
  { href: "/terminal", icon: SquareTerminal, label: "Terminal" },
  { href: "/night-worker", icon: Moon, label: "Night Worker" },
  { href: "/settings", icon: Settings, label: "Settings" },
] as const;

export function SidebarFooter({ currentPath, collapsed = false }: SidebarFooterProps) {
  return (
    <div
      className={cn(
        "border-t border-sidebar-border pt-2 pb-3 flex flex-col gap-0.5",
        collapsed ? "px-1 items-center" : "px-2",
      )}
    >
      {FOOTER_ITEMS.map(({ href, icon: Icon, label }) => {
        const link = (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={collapsed ? label : undefined}
            className={cn(
              "tree-item text-sidebar-foreground no-underline",
              collapsed && "justify-center w-8 h-8 p-0",
              currentPath === href && "active",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {!collapsed && <span className="text-xs">{label}</span>}
          </Link>
        );
        if (collapsed) {
          return (
            <SidebarTooltip key={href} label={label}>
              {link}
            </SidebarTooltip>
          );
        }
        return link;
      })}
    </div>
  );
}
