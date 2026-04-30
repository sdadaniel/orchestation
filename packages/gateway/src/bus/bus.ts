import { randomUUID } from "crypto";
import type { BusEventEnvelope, BusEventType, EventBus } from "@orchestration/bus-types";
import { fileEventStore } from "./file-event-store";

type Listener = (env: BusEventEnvelope) => void;

const RING_CAPACITY = 5000;

class GatewayBusSingleton implements EventBus {
  private static instance: GatewayBusSingleton | null = null;

  private readonly listeners = new Set<Listener>();

  private readonly ring: BusEventEnvelope[] = [];

  private constructor() {}

  static getInstance(): GatewayBusSingleton {
    if (!GatewayBusSingleton.instance) {
      GatewayBusSingleton.instance = new GatewayBusSingleton();
    }

    return GatewayBusSingleton.instance;
  }

  publish<T>(type: BusEventType, data: T): BusEventEnvelope<T> {
    const env: BusEventEnvelope<T> = {
      id: randomUUID(),
      atIso: new Date().toISOString(),
      type,
      data,
    };

    this.remember(env);
    fileEventStore.appendRaw(env);

    for (const listener of this.listeners) {
      listener(env);
    }

    return env;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getLatestEvent(type: BusEventType): BusEventEnvelope | null {
    for (let i = this.ring.length - 1; i >= 0; i--) {
      const env = this.ring[i]!;
      if (env.type === type) {
        return env;
      }
    }

    return fileEventStore.readLatest(type);
  }

  getRecentEvents(type: BusEventType, limit: number): BusEventEnvelope[] {
    const capped = Math.max(1, limit);
    const fromRing = this.ring.filter((env) => env.type === type);
    if (fromRing.length >= capped) {
      return fromRing.slice(-capped);
    }

    return fileEventStore.readRecent(type, capped);
  }

  private remember(env: BusEventEnvelope) {
    this.ring.push(env);
    if (this.ring.length > RING_CAPACITY) {
      this.ring.shift();
    }
  }
}

export const gatewayBus: EventBus = GatewayBusSingleton.getInstance();

export function getGatewayBus(): EventBus {
  return GatewayBusSingleton.getInstance();
}

export function subscribe(listener: Listener): () => void {
  return GatewayBusSingleton.getInstance().subscribe(listener);
}

export function getLatestEvent(type: BusEventType): BusEventEnvelope | null {
  return GatewayBusSingleton.getInstance().getLatestEvent(type);
}

export function getRecentEvents(type: BusEventType, limit: number): BusEventEnvelope[] {
  return GatewayBusSingleton.getInstance().getRecentEvents(type, limit);
}
