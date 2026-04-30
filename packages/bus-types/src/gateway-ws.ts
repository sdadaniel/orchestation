import type { BusEventType } from "./index";

export const GatewayWsMsgType = {
  Ping: "ping",
  Pong: "pong",
  Snapshot: "snapshot",
  Event: "event",
} as const;

export type GatewayWsMsgType = (typeof GatewayWsMsgType)[keyof typeof GatewayWsMsgType];

export interface GatewayWsPingMsg {
  type: typeof GatewayWsMsgType.Ping;
}

export interface GatewayWsPongMsg {
  type: typeof GatewayWsMsgType.Pong;
}

export type GatewayWsSnapshotData = {
  tasksFullHint?: boolean;
  orchestration?: unknown;
} & Record<string, unknown>;

export interface GatewayWsSnapshotMsg {
  type: typeof GatewayWsMsgType.Snapshot;
  id: string;
  data: GatewayWsSnapshotData;
}

export interface GatewayWsEventMsg<T = unknown> {
  type: typeof GatewayWsMsgType.Event;
  id: string;
  eventType: BusEventType | string;
  data: T;
}

export type GatewayWsIncomingControlMsg = GatewayWsPingMsg;

export type GatewayWsOutgoingControlMsg = GatewayWsPongMsg;

