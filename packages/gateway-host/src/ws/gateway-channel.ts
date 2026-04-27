import { WebSocket, type WebSocketServer } from "ws";
import { subscribe, replayAfter, snapshotSeq } from "@/bus/index";
import orchestrationManager from "@/gateway/orchestration-manager";
import { getRpc } from "../rpc/registry";
import type { RpcRequest, RpcResponse } from "../rpc/types";

interface HelloMsg {
  type: "hello";
  lastSeq?: number;
}

type Incoming = HelloMsg | RpcRequest | { type: "ping" };

function sendSafe(ws: WebSocket, obj: unknown) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function buildSnapshot() {
  const state = orchestrationManager.getState();
  return {
    orchestration: {
      status: orchestrationManager.getStatus(),
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      exitCode: state.exitCode,
      taskResults: state.taskResults,
    },
    tasksFullHint: true,
  };
}

export function attachGatewayChannel(wss: WebSocketServer): void {
  wss.on("connection", (ws: WebSocket) => {
    const { head } = snapshotSeq();
    sendSafe(ws, {
      type: "snapshot",
      seq: head,
      data: buildSnapshot(),
    });

    const unsubscribe = subscribe((env) => {
      sendSafe(ws, { type: "event", seq: env.id, event: env.type, data: env.data });
    });

    ws.on("message", async (raw: Buffer | string) => {
      let msg: Incoming;
      try {
        msg = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf-8"));
      } catch {
        sendSafe(ws, { type: "error", message: "bad-json" });
        return;
      }

      if (msg.type === "ping") {
        sendSafe(ws, { type: "pong" });
        return;
      }

      if (msg.type === "hello") {
        const lastSeq = typeof msg.lastSeq === "number" ? msg.lastSeq : 0;
        const { tail } = snapshotSeq();
        if (lastSeq > 0 && lastSeq < tail - 1) {
          sendSafe(ws, { type: "replay-gap", head: snapshotSeq().head });
          return;
        }
        const missed = replayAfter(lastSeq);
        sendSafe(ws, {
          type: "replay",
          events: missed.map((env) => ({
            seq: env.id,
            event: env.type,
            data: env.data,
          })),
        });
        return;
      }

      if (msg.type === "req") {
        const req = msg as RpcRequest;
        const def = getRpc(req.method);
        if (!def) {
          const res: RpcResponse = {
            type: "res",
            id: req.id,
            ok: false,
            error: { code: "UNKNOWN_METHOD", message: req.method },
          };
          sendSafe(ws, res);
          return;
        }

        try {
          const parsed = def.paramsSchema.safeParse(req.params ?? {});
          if (!parsed.success) {
            sendSafe(ws, {
              type: "res",
              id: req.id,
              ok: false,
              error: {
                code: "INVALID_PARAMS",
                message: parsed.error.message,
                details: parsed.error.flatten(),
              },
            } satisfies RpcResponse);
            return;
          }
          const payload = await def.handler(parsed.data);
          sendSafe(ws, { type: "res", id: req.id, ok: true, payload } satisfies RpcResponse);
        } catch (err) {
          const e = err as { code?: string; message?: string };
          sendSafe(ws, {
            type: "res",
            id: req.id,
            ok: false,
            error: {
              code: e?.code ?? "INTERNAL",
              message: e?.message ?? String(err),
            },
          } satisfies RpcResponse);
        }
        return;
      }

      sendSafe(ws, { type: "error", message: "unknown-type" });
    });

    ws.on("close", () => {
      unsubscribe();
    });
    ws.on("error", (err: Error) => {
      console.error("[ws:gateway] error:", err.message);
    });
  });
}
