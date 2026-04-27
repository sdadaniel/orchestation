import type { SseEventEnvelope, SseEventType } from "./types";
import { eventStore } from "./event-store";
import { fileEventStore } from "./store/file-event-store";

type Listener = (env: SseEventEnvelope) => void;
const listeners = new Set<Listener>();

export function publish<T>(type: SseEventType, data: T): SseEventEnvelope<T> {
  const env = eventStore.append(type, data);
  try { fileEventStore.appendRaw(env); } catch { /* ignore */ }
  for (const l of listeners) {
    try { l(env); } catch { /* ignore */ }
  }
  return env;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function replayAfter(lastSeq: number, _limit?: number): SseEventEnvelope[] {
  return eventStore.readAfter(lastSeq);
}

export function snapshotSeq(): { head: number; tail: number } {
  return { head: eventStore.head(), tail: eventStore.tail() };
}
