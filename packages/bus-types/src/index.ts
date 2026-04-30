export type BusEventType =
  | "log.console"
  | "log.dashboard"
  | "orchestration.status"
  | "task.result"
  | "task.changed"
  | "task.terminal";

export interface BusEventEnvelope<T = unknown> {
  id: string;
  atIso: string;
  type: BusEventType;
  data: T;
}

export interface EventBus {
  publish<T>(type: BusEventType, data: T): BusEventEnvelope<T>;
}

export type BusListener = (env: BusEventEnvelope) => void;

export * from "./gateway-ws";
