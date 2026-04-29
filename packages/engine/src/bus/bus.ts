import type { BusEventEnvelope, BusEventType, EventBus } from "./types";

const noopBus: EventBus = {
  publish<T>(type: BusEventType, data: T): BusEventEnvelope<T> {
    return {
      id: "",
      atIso: new Date().toISOString(),
      type,
      data,
    };
  },
};

let engineEventBus: EventBus = noopBus;
let warnedUnconfiguredBus = false;

function warnUnconfiguredBus() {
  if (warnedUnconfiguredBus) return;
  warnedUnconfiguredBus = true;
  console.warn(
    "[engine-bus] publish() called before setEngineEventBus(); event was not propagated.",
  );
}

export function setEngineEventBus(next: EventBus): void {
  engineEventBus = next;
}

export function publish<T>(type: BusEventType, data: T): BusEventEnvelope<T> {
  if (engineEventBus === noopBus) {
    warnUnconfiguredBus();
  }
  return engineEventBus.publish(type, data);
}
