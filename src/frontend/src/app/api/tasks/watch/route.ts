import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { TASKS_DIR } from "@/lib/paths";
import orchestrationManager from "@/lib/orchestration-manager";

export const dynamic = "force-dynamic";

/**
 * GET /api/tasks/watch — SSE 엔드포인트
 *
 * 이벤트:
 * - event: task-changed          → { taskId, status, priority } (변경된 태스크 정보)
 * - event: orchestration-status  → 오케스트레이션 상태 (JSON)
 */
export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${data}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      // ── 태스크 파일 변경 감지 — debounce 없이 즉시 전송 ──
      let fsWatcher: fs.FSWatcher | null = null;

      try {
        fsWatcher = fs.watch(
          TASKS_DIR,
          { recursive: true },
          (_event, filename) => {
            if (!filename?.endsWith(".md")) return;

            // 변경된 파일에서 frontmatter 파싱
            try {
              const filePath = path.join(TASKS_DIR, filename);
              if (!fs.existsSync(filePath)) {
                // 파일 삭제 시
                const idMatch = filename.match(/^(TASK-\d+)/);
                if (idMatch) {
                  send(
                    "task-changed",
                    JSON.stringify({ taskId: idMatch[1], deleted: true }),
                  );
                }
                return;
              }
              const content = fs.readFileSync(filePath, "utf-8");
              const { data } = matter(content);
              if (data.id) {
                send(
                  "task-changed",
                  JSON.stringify({
                    taskId: data.id,
                    status: data.status ?? "pending",
                    priority: data.priority ?? "medium",
                    title: data.title ?? "",
                  }),
                );
              }
            } catch {
              // 파싱 실패 시 fallback: 전체 refetch 트리거
              send("task-changed", JSON.stringify({ full: true }));
            }
          },
        );
      } catch {
        // TASKS_DIR 없으면 무시
      }

      // ── 오케스트레이션 상태 변경 감지 ──
      const onStatusChanged = (data: unknown) => {
        send("orchestration-status", JSON.stringify(data));
      };
      orchestrationManager.events.on("status-changed", onStatusChanged);

      // 연결 직후 현재 상태 전송
      const initialState = orchestrationManager.getState();
      send(
        "orchestration-status",
        JSON.stringify({
          status: initialState.status,
          startedAt: initialState.startedAt,
          finishedAt: initialState.finishedAt,
          exitCode: initialState.exitCode,
          taskResults: initialState.taskResults,
        }),
      );

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
          fsWatcher?.close();
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
