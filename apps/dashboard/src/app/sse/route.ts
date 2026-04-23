import { getDb } from "@/service/db";
import orchestrationManager from "@/engine/orchestration-manager";
import { publish, replayAfter, subscribe, type SseEventEnvelope } from "@/lib/sse";

export const dynamic = "force-dynamic";

function sseFrame(env: SseEventEnvelope): string {
  return `id: ${env.id}\nevent: ${env.type}\ndata: ${JSON.stringify(env.data)}\n\n`;
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let closed = false;

  const url = new URL(request.url);
  const lastIdHeader = request.headers.get("Last-Event-ID");
  const lastIdQuery = url.searchParams.get("lastEventId");
  const rawLastId = lastIdHeader ?? lastIdQuery ?? "0";
  const lastId = rawLastId ? parseInt(rawLastId, 10) : 0;
  const afterId = Number.isFinite(lastId) && lastId >= 0 ? lastId : 0;

  const stream = new ReadableStream({
    start(controller) {
      const send = (env: SseEventEnvelope) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseFrame(env)));
        } catch {
          closed = true;
        }
      };

      // 1) Replay missed events (best-effort, limited by store retention)
      const replay = replayAfter(afterId, 10_000);
      for (const env of replay) send(env);

      // 2) Push current orchestration snapshot right after connect
      publish("orchestration-status", {
        status: orchestrationManager.getStatus(),
        startedAt: orchestrationManager.getState().startedAt,
        finishedAt: orchestrationManager.getState().finishedAt,
        exitCode: orchestrationManager.getState().exitCode,
        taskResults: orchestrationManager.getState().taskResults,
      });

      // 3) Subscribe live
      const unsubscribe = subscribe((env) => send(env));

      // 4) DB polling for task changes (publish to store for reliability)
      let lastMaxUpdated = "";
      try {
        const db = getDb();
        if (db) {
          const row = db
            .prepare("SELECT MAX(updated) as maxUpdated FROM tasks")
            .get() as { maxUpdated: string | null } | undefined;
          lastMaxUpdated = row?.maxUpdated ?? "";
        }
      } catch {
        /* ignore */
      }

      const pollInterval = setInterval(() => {
        if (closed) return;
        try {
          const db = getDb();
          if (!db) return;
          const row = db
            .prepare("SELECT MAX(updated) as maxUpdated FROM tasks")
            .get() as { maxUpdated: string | null } | undefined;
          const current = row?.maxUpdated ?? "";
          if (current && current !== lastMaxUpdated) {
            lastMaxUpdated = current;
            publish("task-changed", { full: true });
          }
        } catch {
          /* ignore */
        }
      }, 1_000);

      // 5) Keepalive
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          closed = true;
        }
      }, 30_000);

      controller.close = new Proxy(controller.close, {
        apply(target, thisArg, args) {
          closed = true;
          clearInterval(pollInterval);
          clearInterval(heartbeat);
          unsubscribe();
          return Reflect.apply(target, thisArg, args);
        },
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

