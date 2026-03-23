import orchestrationManager from "@/lib/orchestration-manager";

export const dynamic = "force-dynamic";

/**
 * GET /api/orchestrate/logs
 *
 * Supports two modes:
 * 1. Polling: GET /api/orchestrate/logs?since=0 → JSON array of log lines
 * 2. SSE:    GET /api/orchestrate/logs?stream=true → Server-Sent Events stream
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stream = searchParams.get("stream") === "true";

  if (!stream) {
    // Polling mode
    const since = parseInt(searchParams.get("since") || "0", 10);
    const validSince = Number.isFinite(since) && since >= 0 ? since : 0;
    const logs = orchestrationManager.getLogs(validSince);
    const state = orchestrationManager.getState();

    return Response.json({
      logs,
      total: state.logs.length,
      status: state.status,
    });
  }

  // SSE mode
  const encoder = new TextEncoder();
  let closed = false;
  let intervalId: ReturnType<typeof setInterval>;

  const readable = new ReadableStream({
    start(controller) {
      let cursor = 0;

      const sendLogs = () => {
        if (closed) return;

        try {
          const newLogs = orchestrationManager.getLogs(cursor);
          const state = orchestrationManager.getState();

          if (newLogs.length > 0) {
            const event = {
              logs: newLogs,
              total: state.logs.length,
              status: state.status,
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
            cursor = state.logs.length;
          }

          // Send status update even when no new logs (for completion detection)
          if (state.status !== "running" && newLogs.length === 0) {
            const event = {
              logs: [],
              total: state.logs.length,
              status: state.status,
              finishedAt: state.finishedAt,
              taskResults: state.taskResults,
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
            // Close the stream after sending final status
            clearInterval(intervalId);
            closed = true;
            controller.close();
          }
        } catch {
          clearInterval(intervalId);
          closed = true;
          try { controller.close(); } catch { /* already closed */ }
        }
      };

      // Poll every 500ms
      intervalId = setInterval(sendLogs, 500);
      // Send initial data immediately
      sendLogs();
    },
    cancel() {
      closed = true;
      clearInterval(intervalId);
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
