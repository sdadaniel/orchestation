import type { SseEventEnvelope, SseEventType } from "./types";
import { fileEventStore } from "./store/file-event-store";

type Listener = (env: SseEventEnvelope) => void;

const listeners = new Set<Listener>();

export function publish<T>(type: SseEventType, data: T): SseEventEnvelope<T> {
  const env = fileEventStore.append(type, data);
  for (const l of listeners) {
    try {
      l(env);
    } catch {
      /* ignore */
    }
  }
  return env;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function replayAfter(afterId: number, limit: number): SseEventEnvelope[] {
  return fileEventStore.readAfter(afterId, limit);
}

