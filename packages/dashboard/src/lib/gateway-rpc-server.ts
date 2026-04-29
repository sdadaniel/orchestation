import { randomUUID } from "crypto";
import { WebSocket } from "ws";

interface RpcError {
  code?: string;
  message?: string;
  details?: unknown;
}

function toGatewayWsUrl(request: Request): string {
  const origin = new URL(request.url).origin;
  const proto = origin.startsWith("https://") ? "wss://" : "ws://";
  return `${proto}${origin.replace(/^https?:\/\//, "")}/ws/gateway`;
}

export async function callGatewayRpc<R>(
  request: Request,
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = 10_000,
): Promise<R> {
  const id = randomUUID();
  const ws = new WebSocket(toGatewayWsUrl(request));

  return await new Promise<R>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.terminate();
      reject({ code: "TIMEOUT", message: `gateway rpc timed out: ${method}` } satisfies RpcError);
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      ws.removeAllListeners();
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "req", id, method, params }));
    });

    ws.on("message", (raw: Buffer | string) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf-8"));
      } catch {
        return;
      }

      if (msg.type !== "res" || msg.id !== id) {
        return;
      }

      cleanup();
      if (msg.ok) {
        resolve(msg.payload as R);
        return;
      }

      reject(
        (msg.error as RpcError | undefined) ?? {
          code: "INTERNAL",
          message: `gateway rpc failed: ${method}`,
        },
      );
    });

    ws.on("error", (error) => {
      cleanup();
      reject({
        code: "DISCONNECTED",
        message: error.message || `gateway rpc socket error: ${method}`,
      } satisfies RpcError);
    });

    ws.on("close", () => {
      cleanup();
      reject({
        code: "DISCONNECTED",
        message: `gateway rpc socket closed: ${method}`,
      } satisfies RpcError);
    });
  });
}

export function getGatewayErrorStatus(err: unknown, fallback = 500): number {
  const code = (err as RpcError | undefined)?.code;
  if (code === "ALREADY_RUNNING" || code === "NOT_RUNNING") return 409;
  if (code === "INVALID_PARAMS") return 400;
  return fallback;
}
