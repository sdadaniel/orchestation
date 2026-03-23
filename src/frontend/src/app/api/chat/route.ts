import { spawn } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 프로젝트 루트 디렉토리 (src/frontend 기준 ../../)
const PROJECT_ROOT = path.resolve(process.cwd(), "../..");

export async function POST(request: Request) {
  let message: string;
  let history: { role: string; content: string }[] | undefined;

  try {
    const body = await request.json();
    message = body.message;
    history = body.history;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!message || typeof message !== "string" || !message.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 대화 히스토리를 컨텍스트로 구성
  let contextMessages = "";
  if (history && Array.isArray(history) && history.length > 0) {
    const recent = history.slice(-10);
    contextMessages = recent
      .map(
        (m) =>
          `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`,
      )
      .join("\n\n");
    contextMessages = `이전 대화:\n${contextMessages}\n\n`;
  }

  const prompt = `${contextMessages}User: ${message}`;

  const stream = new ReadableStream({
    start(controller) {
      const child = spawn(
        "claude",
        ["--print", "--model", "claude-sonnet-4-6", "--output-format", "text"],
        {
          cwd: PROJECT_ROOT,
          env: {
            ...process.env,
            PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
          },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );

      // stdin으로 prompt 전달 후 닫기
      child.stdin.write(prompt);
      child.stdin.end();

      child.stdout.on("data", (chunk: Buffer) => {
        try {
          controller.enqueue(new TextEncoder().encode(chunk.toString()));
        } catch {
          // controller already closed
        }
      });

      let stderrData = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderrData += chunk.toString();
      });

      child.on("close", (code) => {
        if (code !== 0 && stderrData) {
          console.error("Claude CLI stderr:", stderrData);
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      child.on("error", (err) => {
        console.error("Claude CLI spawn error:", err.message);
        try {
          controller.enqueue(
            new TextEncoder().encode(
              "Claude CLI 호출에 실패했습니다. 잠시 후 다시 시도해주세요.",
            ),
          );
          controller.close();
        } catch {
          // already closed
        }
      });

      // 90초 타임아웃
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        try {
          controller.enqueue(
            new TextEncoder().encode("\n[응답 시간이 초과되었습니다]"),
          );
          controller.close();
        } catch {
          // already closed
        }
      }, 90000);

      child.on("close", () => clearTimeout(timeout));
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
