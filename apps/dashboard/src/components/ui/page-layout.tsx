import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
}

function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div className={cn("space-y-4 pb-[500px]", className)}>{children}</div>
  );
}

function PageHeader({ title, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <h1 className="text-lg font-semibold">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export { PageLayout, PageHeader };
