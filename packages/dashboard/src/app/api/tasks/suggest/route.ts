import { NextResponse } from "next/server";
import { spawnClaude, ClaudeChildProcess } from "@/lib/ai/claude-cli";
import { readTemplate } from "@/lib/template";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SUGGEST_TIMEOUT_MS = 15_000;
const SUGGEST_MODEL = "claude-haiku-4-5";

function fallbackSuggestions() {
  return [
    {
      title: "태스크 생성 플로우 타임아웃 UX 개선",
      description:
        "AI 분석/추천이 오래 걸릴 때 즉시 상태를 안내하고, fallback 결과를 제공해 사용자가 막히지 않게 합니다.",
      category: "ux",
      priority: "high",
      scope: ["packages/dashboard/src/app/tasks/new/page.tsx"],
      effort: "small",
    },
    {
      title: "API 에러 메시지 표준화 및 원인 노출",
      description:
        "504/500 등 에러 발생 시 원인(Claude CLI/권한/timeout)을 사용자에게 명확히 보여주고, 재시도 가이드를 제공합니다.",
      category: "docs",
      priority: "medium",
      scope: ["packages/dashboard/src/app/api/tasks/suggest/route.ts"],
      effort: "small",
    },
    {
      title: "태스크/워크플로우 단계 정합성 점검",
      description:
        "status=done인데 step이 failed로 남는 등 정합성 이슈를 방지하기 위해 단계 전이/정렬 규칙을 점검합니다.",
      category: "bug",
      priority: "medium",
      scope: ["packages/engine/src/service/task-store.ts"],
      effort: "small",
    },
    {
      title: "E2E: New Task 생성 시나리오 추가",
      description:
        "Analyze → Preview → Confirm 흐름이 깨지지 않도록 Playwright e2e 테스트를 추가합니다.",
      category: "test",
      priority: "low",
      scope: ["packages/dashboard/e2e"],
      effort: "medium",
    },
    {
      title: "AI 호출 모델/타임아웃 설정값화",
      description:
        "환경별로 AI 모델과 타임아웃을 조정할 수 있도록 설정으로 분리해 안정성과 비용을 균형 있게 운영합니다.",
      category: "refactor",
      priority: "low",
      scope: ["packages/engine/src/lib/ai/claude-cli.ts"],
      effort: "medium",
    },
  ];
}

export async function POST() {
  const prompt = readTemplate("prompt/task-suggest.md");

  return new Promise<Response>((resolve) => {
    const child: ClaudeChildProcess = spawnClaude(prompt, {
      model: SUGGEST_MODEL,
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
          {
            suggestions: fallbackSuggestions(),
            error:
              "AI 추천이 지연되어 fallback 추천을 표시합니다. (원하면 다시 시도하세요)",
          },
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
            {
              suggestions: fallbackSuggestions(),
              error: "AI 분석 실패. fallback 추천을 표시합니다.",
            },
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
              suggestions: fallbackSuggestions(),
              error: "추천 결과를 파싱할 수 없습니다. fallback 추천을 표시합니다.",
            }),
          );
          return;
        }

        const data = JSON.parse(jsonMatch[0]);
        resolve(NextResponse.json(data));
      } catch {
        resolve(
          NextResponse.json({
            suggestions: fallbackSuggestions(),
            error: "추천 결과를 파싱할 수 없습니다. fallback 추천을 표시합니다.",
          }),
        );
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeoutTimer);
      resolve(
        NextResponse.json(
          {
            suggestions: fallbackSuggestions(),
            error: `AI 호출 실패. fallback 추천을 표시합니다. (${String(err.message || err)})`,
          },
          { status: 500 },
        ),
      );
    });
  });
}
