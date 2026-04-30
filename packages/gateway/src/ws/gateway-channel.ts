import { WebSocket, type WebSocketServer } from "ws";
import { getRpc } from "../rpc/registry";
import type { RpcRequest, RpcResponse } from "../rpc/types";
import { randomUUID } from "crypto";
import { getLatestEvent, subscribe } from "../bus/bus";
import type { OrchestrationStatusData } from "@/orchestrate/orchestration-manager";
import {
  GatewayWsMsgType,
  type GatewayWsPingMsg,
  type GatewayWsSnapshotMsg,
  type GatewayWsEventMsg,
} from "@orchestration/bus-types";

type Incoming = GatewayWsPingMsg | RpcRequest;

function sendSafe(ws: WebSocket, obj: unknown) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function buildSnapshot() {
  const latest = getLatestEvent("orchestration.status");
  return {
    ...(latest ? { orchestration: latest.data as OrchestrationStatusData } : {}),
    tasksFullHint: true,
  };
}

export function attachGatewayChannel(wss: WebSocketServer): void {
  wss.on("connection", (ws: WebSocket) => {
    const snapshotMsg: GatewayWsSnapshotMsg = {
      type: GatewayWsMsgType.Snapshot,
      id: randomUUID(),
      data: buildSnapshot(),
    };
    sendSafe(ws, snapshotMsg);

    const unsubscribe = subscribe((env) => {
      const eventMsg: GatewayWsEventMsg = {
        type: GatewayWsMsgType.Event,
        id: env.id,
        eventType: env.type,
        data: env.data,
      };
      sendSafe(ws, eventMsg);
    });

    ws.on("message", async (raw: Buffer | string) => {
      let msg: Incoming;
      try {
        msg = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf-8"));
      } catch {
        sendSafe(ws, { type: "error", message: "bad-json" });
        return;
      }

      if (msg.type === GatewayWsMsgType.Ping) {
        sendSafe(ws, { type: GatewayWsMsgType.Pong });
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
