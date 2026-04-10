export const VALID_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type Priority = (typeof VALID_PRIORITIES)[number];

export const VALID_STATUSES = [
  "pending",
  "stopped",
  "in_progress",
  "reviewing",
  "done",
  "failed",
  "rejected",
] as const;
export type Status = (typeof VALID_STATUSES)[number];
