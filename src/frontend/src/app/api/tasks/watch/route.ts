import fs from "fs";
import path from "path";
import { TASKS_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

/** SSE endpoint — task 파일 변경 시 즉시 알림 */
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${event}\n\n`));
        } catch { /* closed */ }
      };

      // 초기 연결 확인
      send("connected");

      // 파일 감시
      let watcher: fs.FSWatcher | null = null;
      let debounce: ReturnType<typeof setTimeout> | null = null;

      try {
        watcher = fs.watch(TASKS_DIR, { recursive: true }, (_event, filename) => {
          if (!filename?.endsWith(".md")) return;
          // 디바운스: 연속 변경 시 100ms 후 1회만 전송
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => send("changed"), 100);
        });
      } catch {
        send("watch-error");
      }

      // 30초마다 keep-alive
      const keepAlive = setInterval(() => send("ping"), 30000);

      // 클린업 (연결 종료 시)
      const cleanup = () => {
        if (watcher) watcher.close();
        if (debounce) clearTimeout(debounce);
        clearInterval(keepAlive);
        try { controller.close(); } catch { /* already closed */ }
      };

      // 5분 후 자동 종료 (클라이언트가 재연결)
      setTimeout(cleanup, 5 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
