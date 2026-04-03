import { spawnClaude, CLAUDE_DEFAULT_TIMEOUT_MS, ClaudeChildProcess } from "@/lib/claude-cli";
import { jsonErrorResponse } from "@/lib/error-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  let message: string;
  let history: { role: string; content: string }[] | undefined;

  try {
    const body = await request.json();
    message = body.message;
    history = body.history;
  } catch {
    return jsonErrorResponse("Invalid JSON body");
  }

  if (!message || typeof message !== "string" || !message.trim()) {
    return jsonErrorResponse("message is required");
  }

  // 대화 히스토리를 컨텍스트로 구성
  let contextMessages = "";
  if (history && Array.isArray(history) && history.length > 0) {
    const recent = history.slice(-10);
    contextMessages = recent
      .map(
        (m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`,
      )
      .join("\n\n");
    contextMessages = `이전 대화:\n${contextMessages}\n\n`;
  }

  const prompt = `${contextMessages}User: ${message}`;

  const stream = new ReadableStream({
    start(controller) {
      const child: ClaudeChildProcess = spawnClaude(prompt);
      let controllerClosed = false;

      function safeEnqueue(data: Uint8Array) {
        if (!controllerClosed) {
          try {
            controller.enqueue(data);
          } catch {
            // already closed
          }
        }
      }

      function safeClose() {
        if (!controllerClosed) {
          controllerClosed = true;
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }

      child.stdout.on("data", (chunk: Buffer) => {
        safeEnqueue(new TextEncoder().encode(chunk.toString()));
      });

      let stderrData = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderrData += chunk.toString();
      });

      // 타임아웃: SIGTERM은 spawnClaude 내부에서 처리됨.
      // 여기서는 사용자에게 타임아웃 메시지를 전달한다.
      let timedOut = false;
      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        safeEnqueue(
          new TextEncoder().encode("\n[응답 시간이 초과되었습니다]"),
        );
        safeClose();
      }, CLAUDE_DEFAULT_TIMEOUT_MS);

      child.on("close", (code) => {
        clearTimeout(timeoutTimer);
        if (timedOut) return; // 타임아웃 핸들러가 이미 처리했음
        if (code !== 0 && stderrData) {
          console.error("Claude CLI stderr:", stderrData);
        }
        safeClose();
      });

      child.on("error", (err) => {
        clearTimeout(timeoutTimer);
        console.error("Claude CLI spawn error:", err.message);
        safeEnqueue(
          new TextEncoder().encode(
            "Claude CLI 호출에 실패했습니다. 잠시 후 다시 시도해주세요.",
          ),
        );
        safeClose();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
