import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 프로젝트 루트 디렉토리 (src/frontend 기준 ../../)
const PROJECT_ROOT = path.resolve(process.cwd(), "../..");

export async function POST(request: Request) {
  try {
    const { message, history } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    // 대화 히스토리를 컨텍스트로 구성
    let contextMessages = "";
    if (history && Array.isArray(history) && history.length > 0) {
      // 최근 10개 메시지만 컨텍스트로 전달
      const recent = history.slice(-10);
      contextMessages = recent
        .map((m: { role: string; content: string }) =>
          `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`,
        )
        .join("\n\n");
      contextMessages = `이전 대화:\n${contextMessages}\n\n`;
    }

    const prompt = `${contextMessages}User: ${message}`;

    // claude CLI 호출 — input 옵션으로 stdin 전달 (shell injection 방지)
    const result = execSync(
      `claude --print --model claude-sonnet-4-6 --output-format json`,
      {
        input: prompt,
        timeout: 90000,
        encoding: "utf-8",
        cwd: PROJECT_ROOT,
        env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}` },
      },
    );

    const parsed = JSON.parse(result);
    const response = parsed.result || parsed.text || result;

    return NextResponse.json({ response });
  } catch (err: any) {
    console.error("Chat API error:", err.message);

    // claude CLI stdout에서 직접 추출 시도
    if (err.stdout) {
      try {
        const parsed = JSON.parse(err.stdout);
        return NextResponse.json({ response: parsed.result || parsed.text || err.stdout });
      } catch {
        return NextResponse.json({ response: err.stdout.toString().trim() || "응답 처리 중 오류가 발생했습니다." });
      }
    }

    return NextResponse.json(
      { response: "Claude CLI 호출에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
