"use client";

import Link from "next/link";
import { DollarSign, SquareTerminal, Settings, Activity, Moon } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import type { SidebarFooterProps } from "./types";

type FooterLink = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const LINKS: FooterLink[] = [
  { href: "/cost", label: "Cost", icon: DollarSign },
  { href: "/log", label: "Log", icon: Activity },
  { href: "/terminal", label: "Terminal", icon: SquareTerminal },
  { href: "/night-worker", label: "Night Worker", icon: Moon },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarFooter({ currentPath, collapsed = false }: SidebarFooterProps) {
  return (
    <div
      className={cn(
        "border-t border-sidebar-border pt-2 pb-3 flex flex-col gap-0.5",
        collapsed ? "px-1 items-center" : "px-2",
      )}
    >
      {LINKS.map(({ href, label, icon: Icon }) => {
        const isActive = currentPath === href;
        return (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            aria-label={label}
            className={cn(
              "tree-item text-sidebar-foreground no-underline",
              isActive && "active",
              collapsed && "justify-center w-9 h-9 p-0",
            )}
          >
            <Icon className={cn("shrink-0", collapsed ? "h-4 w-4" : "h-3.5 w-3.5")} />
            {!collapsed && <span className="text-xs">{label}</span>}
          </Link>
        );
      })}
    </div>
  );
}
