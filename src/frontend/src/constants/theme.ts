// Terminal color constants
export const TERMINAL_BG = "bg-[#0d1117]";
export const TERMINAL_HEADER_BG = "bg-[#161b22]";

// Task 상태 스타일
export const STATUS_STYLES = {
  stopped: { bg: "bg-violet-500", dot: "bg-violet-500", label: "Stopped" },
  pending: { bg: "bg-gray-500", dot: "bg-yellow-500", label: "Pending" },
  in_progress: { bg: "bg-blue-500", dot: "bg-blue-500", label: "In Progress" },
  reviewing: { bg: "bg-orange-500", dot: "bg-orange-400", label: "Reviewing" },
  done: { bg: "bg-green-500", dot: "bg-emerald-500", label: "Done" },
  failed: { bg: "bg-red-500", dot: "bg-red-500", label: "Failed" },
  rejected: { bg: "bg-red-500", dot: "bg-red-500", label: "Rejected" },
} as const;

// 우선순위 스타일
export const PRIORITY_STYLES = {
  high: { bg: "bg-red-500/15", text: "text-red-400", label: "High" },
  medium: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Medium" },
  low: { bg: "bg-green-500/15", text: "text-green-400", label: "Low" },
} as const;
