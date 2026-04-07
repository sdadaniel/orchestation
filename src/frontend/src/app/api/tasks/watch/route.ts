import { getDb } from "@/service/db";
import orchestrationManager from "@/engine/orchestration-manager";

export const dynamic = "force-dynamic";

/**
 * GET /api/tasks/watch — SSE 엔드포인트
 *
 * 이벤트:
 * - event: task-changed          → { full: true } (DB 변경 감지 시 전체 refetch 트리거)
 * - event: orchestration-status  → 오케스트레이션 상태 (JSON)
 *
 * DB polling 방식: 1초마다 MAX(updated) 확인하여 변경 감지
 */
export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          closed = true;
        }
      };

      // ── DB polling으로 태스크 변경 감지 ──
      let lastMaxUpdated = "";
      try {
        const db = getDb();
        if (db) {
          const row = db.prepare("SELECT MAX(updated) as maxUpdated FROM tasks").get() as { maxUpdated: string | null } | undefined;
          lastMaxUpdated = row?.maxUpdated ?? "";
        }
      } catch {
        // ignore
      }

      const pollInterval = setInterval(() => {
        if (closed) return;
        try {
          const db = getDb();
          if (!db) return;
          const row = db.prepare("SELECT MAX(updated) as maxUpdated FROM tasks").get() as { maxUpdated: string | null } | undefined;
          const current = row?.maxUpdated ?? "";
          if (current && current !== lastMaxUpdated) {
            lastMaxUpdated = current;
            send("task-changed", JSON.stringify({ full: true }));
          }
        } catch {
          // ignore polling errors
        }
      }, 1_000);

      // ── 오케스트레이션 상태 변경 감지 ──
      const onStatusChanged = (data: unknown) => {
        send("orchestration-status", JSON.stringify(data));
      };
      orchestrationManager.events.on("status-changed", onStatusChanged);

      // 연결 직후 현재 상태 전송
      const initialState = orchestrationManager.getState();
      send("orchestration-status", JSON.stringify({
        status: initialState.status,
        startedAt: initialState.startedAt,
        finishedAt: initialState.finishedAt,
        exitCode: initialState.exitCode,
        taskResults: initialState.taskResults,
      }));

      // ── 하트비트 (30초) — 연결 유지 ──
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          closed = true;
        }
      }, 30_000);

      // ── 정리 ──
      controller.close = new Proxy(controller.close, {
        apply(target, thisArg, args) {
          closed = true;
          clearInterval(pollInterval);
          orchestrationManager.events.off("status-changed", onStatusChanged);
          clearInterval(heartbeat);
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
