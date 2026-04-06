import { NextResponse } from "next/server";
import { spawnClaude, ClaudeChildProcess } from "@/lib/claude-cli";
import { readTemplate } from "@/lib/template";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SUGGEST_TIMEOUT_MS = 120_000;

export async function POST() {
  const prompt = readTemplate("prompt/task-suggest.md");

  return new Promise<Response>((resolve) => {
    const child: ClaudeChildProcess = spawnClaude(prompt, {
      timeout: SUGGEST_TIMEOUT_MS,
      extraArgs: ["--dangerously-skip-permissions"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    let timedOut = false;
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      resolve(
        NextResponse.json(
          { suggestions: [], error: "추천 요청이 타임아웃되었습니다. 다시 시도해주세요." },
          { status: 504 },
        ),
      );
    }, SUGGEST_TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(timeoutTimer);
      if (timedOut) return;

      if (code !== 0) {
        resolve(
          NextResponse.json(
            { suggestions: [], error: "AI 분석 실패. 다시 시도해주세요." },
            { status: 500 },
          ),
        );
        return;
      }

      try {
        const jsonMatch = stdout.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
        if (!jsonMatch) {
          resolve(
            NextResponse.json({
              suggestions: [],
              error: "추천 결과를 파싱할 수 없습니다.",
            }),
          );
          return;
        }

        const data = JSON.parse(jsonMatch[0]);
        resolve(NextResponse.json(data));
      } catch {
        resolve(
          NextResponse.json({
            suggestions: [],
            error: "추천 결과를 파싱할 수 없습니다.",
          }),
        );
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeoutTimer);
      resolve(
        NextResponse.json(
          { suggestions: [], error: "AI 호출 실패. 다시 시도해주세요." },
          { status: 500 },
        ),
      );
    });
  });
}
