// ── Status ────────────────────────────────────────────

export const STATUS_DOT: Record<string, string> = {
  stopped: "bg-violet-500",
  pending: "bg-yellow-500",
  in_progress: "bg-blue-500",
  reviewing: "bg-orange-500",
  done: "bg-emerald-500",
  rejected: "bg-red-500",
};

export const STATUS_LABEL: Record<string, string> = {
  stopped: "Stopped",
  pending: "Pending",
  in_progress: "In Progress",
  reviewing: "Reviewing",
  done: "Done",
  rejected: "Rejected",
};

export const STATUS_ORDER = ["in_progress", "reviewing", "stopped", "pending", "done", "rejected"];

// ── Priority ─────────────────────────────────────────

export const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-500 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  low: "bg-green-500/15 text-green-500 border-green-500/30",
};

// ── Tabs ─────────────────────────────────────────────

export const TAB_STACK = "current";
export const TAB_ALL = "all";
export const TABS = [TAB_STACK, TAB_ALL, ...STATUS_ORDER] as const;
export const TAB_LABEL: Record<string, string> = { current: "Graph", all: "All", ...STATUS_LABEL };

// ── DAG Layout ───────────────────────────────────────

export const NODE_W = 220;
export const NODE_H = 84;
export const ROW_GAP = 24;
export const CANVAS_PAD = 40;
export const SECTION_GAP = 40;
export const SECTION_HEADER_H = 32;
