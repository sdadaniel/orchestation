"use client";

import Link from "next/link";
import { DollarSign, SquareTerminal, Settings, Activity, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidebarFooterProps } from "./types";

const FOOTER_ITEMS = [
  { href: "/cost", icon: DollarSign, label: "Cost" },
  { href: "/log", icon: Activity, label: "Log" },
  { href: "/terminal", icon: SquareTerminal, label: "Terminal" },
  { href: "/night-worker", icon: Moon, label: "Night Worker" },
  { href: "/settings", icon: Settings, label: "Settings" },
] as const;

export function SidebarFooter({ currentPath, collapsed }: SidebarFooterProps) {
  if (collapsed) {
    return (
      <div className="border-t border-sidebar-border px-1.5 pt-2 pb-3 flex flex-col items-center gap-0.5">
        {FOOTER_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={label}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md transition-colors no-underline",
              "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
              currentPath === href && "bg-sidebar-accent text-primary",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="border-t border-sidebar-border px-2 pt-2 pb-3 flex flex-col gap-0.5">
      {FOOTER_ITEMS.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "tree-item text-sidebar-foreground no-underline",
            currentPath === href && "active",
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="text-xs">{label}</span>
        </Link>
      ))}
    </div>
  );
}
