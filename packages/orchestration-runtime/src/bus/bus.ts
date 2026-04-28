import type { BusEventEnvelope, BusEventType } from "./types";
import { eventStore } from "./event-store";
import { fileEventStore } from "./store/file-event-store";

type Listener = (env: BusEventEnvelope) => void;
const listeners = new Set<Listener>();

export function publish<T>(type: BusEventType, data: T): BusEventEnvelope<T> {
  const env = eventStore.append(type, data);
  fileEventStore.appendRaw(env);
  for (const l of listeners) {
    l(env);
  }
  return env;

}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
