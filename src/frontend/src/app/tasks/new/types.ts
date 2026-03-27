import type { TaskOption } from "@/components/DependsOnSelector";

export interface AnalyzedTask {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  criteria: string[];
  scope?: string[];
  /** Reference files (read-only, not modified) */
  context?: string[];
  /** Within-batch dependency indices (0-based) */
  depends_on?: number[];
  /** Pre-existing TASK-XXX IDs this task depends on */
  external_depends_on?: string[];
  /** Worker role assignment */
  role?: string;
}

export const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-500 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  low: "bg-green-500/15 text-green-500 border-green-500/30",
};

export const CATEGORY_ICON: Record<string, string> = {
  bug: "\uD83D\uDC1B", refactor: "\uD83D\uDD04", performance: "\u26A1", test: "\uD83E\uDDEA",
  docs: "\uD83D\uDCDD", ux: "\uD83C\uDFA8", security: "\uD83D\uDD12", cleanup: "\uD83E\uDDF9",
};

export const EFFORT_LABEL: Record<string, string> = {
  small: "30\uBD84 \uC774\uB0B4", medium: "1-2\uC2DC\uAC04", large: "\uBC18\uB098\uC808+",
};

export type { TaskOption };
