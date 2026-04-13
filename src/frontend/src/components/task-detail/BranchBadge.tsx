"use client";

import { useState } from "react";
import { GitBranch, Check } from "lucide-react";

export function BranchBadge({ branch }: { branch: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(branch);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono max-w-[240px] truncate hover:text-foreground transition-colors cursor-pointer"
      title="클릭하여 복사"
    >
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-400" />
      ) : (
        <GitBranch className="h-3 w-3 shrink-0" />
      )}
      <span className="truncate">{branch}</span>
      {copied && (
        <span className="text-emerald-400 text-[9px] ml-0.5">copied</span>
      )}
    </button>
  );
}
