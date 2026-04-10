"use client";

import Link from "next/link";
import {
  DollarSign,
  SquareTerminal,
  Settings,
  Activity,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Props ── */

export interface SidebarFooterProps {
  currentPath: string;
}

/* ── Component ── */

export function SidebarFooter({ currentPath }: SidebarFooterProps) {
  return (
    <div className="border-t border-sidebar-border px-2 pt-2 pb-3 flex flex-col gap-0.5">
      <Link
        href="/cost"
        className={cn(
          "tree-item text-sidebar-foreground no-underline",
          currentPath === "/cost" && "active",
        )}
      >
        <DollarSign className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs">Cost</span>
      </Link>
      <Link
        href="/monitor"
        className={cn(
          "tree-item text-sidebar-foreground no-underline",
          currentPath === "/monitor" && "active",
        )}
      >
        <Activity className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs">Monitor</span>
      </Link>
      <Link
        href="/terminal"
        className={cn(
          "tree-item text-sidebar-foreground no-underline",
          currentPath === "/terminal" && "active",
        )}
      >
        <SquareTerminal className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs">Terminal</span>
      </Link>
      <Link
        href="/night-worker"
        className={cn(
          "tree-item text-sidebar-foreground no-underline",
          currentPath === "/night-worker" && "active",
        )}
      >
        <Moon className="h-3.5 w-3.5" />
        <span className="text-xs">Night Worker</span>
      </Link>
      <Link
        href="/settings"
        className={cn(
          "tree-item text-sidebar-foreground no-underline",
          currentPath === "/settings" && "active",
        )}
      >
        <Settings className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs">Settings</span>
      </Link>
    </div>
  );
}
