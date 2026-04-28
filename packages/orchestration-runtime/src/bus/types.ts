export type BusEventType =
  | "log"
  | "orchestration-status"
  | "task-result"
  | "task-changed"
  | "task-terminal";

export type BusEventEnvelope<T = unknown> = {
  id: string;
  atIso: string;
  type: BusEventType;
  data: T;
};
