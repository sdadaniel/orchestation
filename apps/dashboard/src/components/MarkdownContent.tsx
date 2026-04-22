"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function MarkdownContent({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("prose-custom", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
