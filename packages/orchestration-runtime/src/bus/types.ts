export type BusEventType =
  | "log"
  | "orchestration-status"
  | "task-result"
  | "task-changed"
  | "task-terminal";

export type BusEventEnvelope<T = unknown> = {
  id: number;
  atIso: string;
  type: BusEventType;
  data: T;
};
