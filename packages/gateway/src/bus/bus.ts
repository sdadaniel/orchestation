import { randomUUID } from "crypto";
import type { BusEventEnvelope, BusEventType, EventBus } from "@orchestration/bus-types";
import { fileEventStore } from "./file-event-store";

type Listener = (env: BusEventEnvelope) => void;

const listeners = new Set<Listener>();
const ring: BusEventEnvelope[] = [];
const RING_CAPACITY = 5000;

function remember(env: BusEventEnvelope) {
  ring.push(env);
  if (ring.length > RING_CAPACITY) {
    ring.shift();
  }
}

export const gatewayBus: EventBus = {
  publish<T>(type: BusEventType, data: T): BusEventEnvelope<T> {
    const env: BusEventEnvelope<T> = {
      id: randomUUID(),
      atIso: new Date().toISOString(),
      type,
      data,
    };

    remember(env);
    fileEventStore.appendRaw(env);

    for (const listener of listeners) {
      listener(env);
    }

    return env;
  },
};

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLatestEvent(type: BusEventType): BusEventEnvelope | null {
  for (let i = ring.length - 1; i >= 0; i--) {
    const env = ring[i]!;
    if (env.type === type) {
      return env;
    }
  }

  return fileEventStore.readLatest(type);
}

export function getRecentEvents(type: BusEventType, limit: number): BusEventEnvelope[] {
  const capped = Math.max(1, limit);
  const fromRing = ring.filter((env) => env.type === type);
  if (fromRing.length >= capped) {
    return fromRing.slice(-capped);
  }

  return fileEventStore.readRecent(type, capped);
}
