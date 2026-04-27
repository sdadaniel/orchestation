import type { SseEventEnvelope, SseEventType } from "./types";

const DEFAULT_CAPACITY = 5000;

export interface EventStore {
  append<T>(type: SseEventType, data: T): SseEventEnvelope<T>;
  readAfter(lastSeq: number): SseEventEnvelope[];
  head(): number;
  tail(): number;
}

export function createRingEventStore(capacity = DEFAULT_CAPACITY): EventStore {
  const buf: SseEventEnvelope[] = [];
  let seqCounter = 0;

  return {
    append<T>(type: SseEventType, data: T): SseEventEnvelope<T> {
      seqCounter += 1;
      const env: SseEventEnvelope<T> = {
        id: seqCounter,
        atIso: new Date().toISOString(),
        type,
        data,
      };
      buf.push(env as SseEventEnvelope);
      if (buf.length > capacity) buf.shift();
      return env;
    },
    readAfter(lastSeq: number): SseEventEnvelope[] {
      if (buf.length === 0) return [];
      const oldest = buf[0].id;
      if (lastSeq < oldest - 1) return []; // gap: caller must fallback to snapshot
      return buf.filter((e) => e.id > lastSeq);
    },
    head(): number {
      return buf.length === 0 ? 0 : buf[buf.length - 1].id;
    },
    tail(): number {
      return buf.length === 0 ? 0 : buf[0].id;
    },
  };
}

export const eventStore = createRingEventStore();
