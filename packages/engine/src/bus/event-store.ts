import type { BusEventEnvelope, BusEventType } from "./types";
import { randomUUID } from "crypto";

const DEFAULT_CAPACITY = 5000;

export interface EventStore {
  append<T>(type: BusEventType, data: T): BusEventEnvelope<T>;
}

export function createRingEventStore(capacity = DEFAULT_CAPACITY): EventStore {
  const buf: BusEventEnvelope[] = [];

  return {
    append<T>(type: BusEventType, data: T): BusEventEnvelope<T> {
      const env: BusEventEnvelope<T> = {
        id: randomUUID(),
        atIso: new Date().toISOString(),
        type,
        data,
      };
      buf.push(env as BusEventEnvelope);
      if (buf.length > capacity) buf.shift();
      return env;
    },
  };
}

export const eventStore = createRingEventStore();
