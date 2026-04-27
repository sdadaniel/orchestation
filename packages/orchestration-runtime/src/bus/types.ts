export type SseEventType =
  | "log"
  | "orchestration-status"
  | "task-result"
  | "task-changed"
  | "task-terminal";

export type SseEventEnvelope<T = unknown> = {
  id: number;
  atIso: string;
  type: SseEventType;
  data: T;
};
