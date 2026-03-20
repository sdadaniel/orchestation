"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Calendar, FileText, SquareTerminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  disabled: boolean;
}

const navItems: NavItem[] = [
  {
    label: "Task",
    icon: <ClipboardList className="h-4 w-4" />,
    href: "/",
    disabled: false,
  },
  {
    label: "Terminal",
    icon: <SquareTerminal className="h-4 w-4" />,
    href: "/terminal",
    disabled: false,
  },
  {
    label: "Sprint",
    icon: <Calendar className="h-4 w-4" />,
    href: "/sprint",
    disabled: true,
  },
  {
    label: "Plan",
    icon: <FileText className="h-4 w-4" />,
    href: "/plan",
    disabled: true,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-4 py-5">
        <h1 className="text-lg font-semibold text-sidebar-foreground">
          Dashboard
        </h1>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          if (item.disabled) {
            return (
              <span
                key={item.label}
                className={cn(
                  buttonVariants({ variant: "sidebarDisabled", size: "sidebar" }),
                  "pointer-events-none"
                )}
                aria-disabled="true"
              >
                {item.icon}
                {item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                buttonVariants({
                  variant: isActive ? "sidebarActive" : "sidebar",
                  size: "sidebar",
                })
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
