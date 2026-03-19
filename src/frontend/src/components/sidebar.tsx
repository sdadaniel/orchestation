"use client";

import { ClipboardList, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  disabled: boolean;
}

const navItems: NavItem[] = [
  {
    label: "Task",
    icon: <ClipboardList className="h-4 w-4" />,
    active: true,
    disabled: false,
  },
  {
    label: "Sprint",
    icon: <Calendar className="h-4 w-4" />,
    active: false,
    disabled: true,
  },
  {
    label: "Plan",
    icon: <FileText className="h-4 w-4" />,
    active: false,
    disabled: true,
  },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-4 py-5">
        <h1 className="text-lg font-semibold text-sidebar-foreground">
          Dashboard
        </h1>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => (
          <Button
            key={item.label}
            variant={
              item.active
                ? "sidebarActive"
                : item.disabled
                  ? "sidebarDisabled"
                  : "sidebar"
            }
            size="sidebar"
            disabled={item.disabled}
            aria-current={item.active ? "page" : undefined}
          >
            {item.icon}
            {item.label}
          </Button>
        ))}
      </nav>
    </aside>
  );
}
