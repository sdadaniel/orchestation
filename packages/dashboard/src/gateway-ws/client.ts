"use client";

type AnyObject = Record<string, unknown>;

type EventHandler = (event: string, data: unknown, id: string) => void;
type SnapshotHandler = (data: AnyObject) => void;

interface PendingRpc {
  resolve: (payload: unknown) => void;
  reject: (err: unknown) => void;
  method: string;
  idempotent: boolean;
  timeout: ReturnType<typeof setTimeout>;
}

export interface GatewayClientOpts {
  url: string;
  onEvent: EventHandler;
  onSnapshot: SnapshotHandler;
  isIdempotent: (method: string) => boolean;
  rpcTimeoutMs?: number;
}

export interface GatewayClient {
  call<P extends AnyObject, R>(method: string, params?: P): Promise<R>;
  close(): void;
}

const BACKOFF_MIN = 500;
const BACKOFF_MAX = 30_000;

export function createGatewayClient(opts: GatewayClientOpts): GatewayClient {
  let ws: WebSocket | null = null;
  let closed = false;
  let backoff = BACKOFF_MIN;
  const pending = new Map<string, PendingRpc>();
  const rpcTimeoutMs = opts.rpcTimeoutMs ?? 30_000;

  function scheduleReconnect() {
    if (closed) return;
    const jitter = Math.random() * backoff * 0.2;
    setTimeout(connect, Math.min(BACKOFF_MAX, backoff + jitter));
    backoff = Math.min(BACKOFF_MAX, backoff * 2);
  }

  function connect() {
    if (closed) return;
    try {
      ws = new WebSocket(opts.url);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.addEventListener("open", () => {
      backoff = BACKOFF_MIN;
      ws?.send(JSON.stringify({ type: "hello" }));
    });

    ws.addEventListener("message", (e: MessageEvent) => {
      let msg: AnyObject;
      try { msg = JSON.parse(String(e.data ?? "")); } catch { return; }

      if (msg.type === "snapshot") {
        opts.onSnapshot(msg.data as AnyObject);
        return;
      }

      if (msg.type === "event") {
        const id = typeof msg.id === "string" ? msg.id : "";
        opts.onEvent(String(msg.event), msg.data, id);
        return;
      }

      if (msg.type === "res" && typeof msg.id === "string") {
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id);
        clearTimeout(p.timeout);
        if (msg.ok) p.resolve(msg.payload);
        else p.reject(msg.error ?? { code: "ERROR", message: "unknown" });
        return;
      }
    });

    ws.addEventListener("close", () => {
      for (const [id, p] of pending) {
        if (!p.idempotent) {
          pending.delete(id);
          clearTimeout(p.timeout);
          p.reject({ code: "DISCONNECTED", message: "ws closed" });
        }
      }
      scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      try { ws?.close(); } catch { /* ignore */ }
    });
  }

  connect();

  return {
    call<P extends AnyObject, R>(method: string, params?: P): Promise<R> {
      return new Promise<R>((resolve, reject) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const idempotent = opts.isIdempotent(method);
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject({ code: "TIMEOUT", message: "rpc timeout" });
        }, rpcTimeoutMs);
        pending.set(id, { resolve: resolve as (p: unknown) => void, reject, method, idempotent, timeout });

        const trySend = () => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "req", id, method, params: params ?? {} }));
          } else if (idempotent) {
            setTimeout(trySend, 100);
          } else {
            pending.delete(id);
            clearTimeout(timeout);
            reject({ code: "DISCONNECTED", message: "ws not open" });
          }
        };
        trySend();
      });
    },
    close() {
      closed = true;
      try { ws?.close(); } catch { /* ignore */ }
      ws = null;
    },
  };
}
