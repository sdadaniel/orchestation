"use client";

export type SseConnectOpts = {
  url: string;
  lastEventIdKey: string;
  onEvent: (evt: { id: string; type: string; data: unknown }) => void;
  onError?: () => void;
};

export function connectSse(opts: SseConnectOpts): () => void {
  let closed = false;
  let es: EventSource | null = null;

  const connect = () => {
    if (closed) return;
    const lastId = localStorage.getItem(opts.lastEventIdKey) ?? "";
    // Native EventSource doesn't let us set Last-Event-ID header directly.
    // We pass it via query param; server can also accept it.
    const url = lastId
      ? `${opts.url}?lastEventId=${encodeURIComponent(lastId)}`
      : opts.url;
    es = new EventSource(url);

    const handle = (type: string) => (e: Event) => {
      const ev = e as MessageEvent;
      const id = (ev as any).lastEventId ?? "";
      if (id) localStorage.setItem(opts.lastEventIdKey, id);
      try {
        opts.onEvent({ id, type, data: JSON.parse(String(ev.data ?? "")) });
      } catch {
        opts.onEvent({ id, type, data: ev.data });
      }
    };

    es.onmessage = handle("message") as any;
    es.addEventListener("log", handle("log"));
    es.addEventListener("orchestration-status", handle("orchestration-status"));
    es.addEventListener("task-result", handle("task-result"));
    es.addEventListener("task-changed", handle("task-changed"));

    es.onerror = () => {
      opts.onError?.();
      try {
        es?.close();
      } catch {
        /* ignore */
      }
      es = null;
      setTimeout(connect, 1000);
    };
  };

  connect();

  return () => {
    closed = true;
    try {
      es?.close();
    } catch {
      /* ignore */
    }
    es = null;
  };
}

