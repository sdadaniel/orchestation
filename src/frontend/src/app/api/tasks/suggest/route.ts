import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

const PROJECT_ROOT = path.resolve(process.cwd(), "..", "..");

export async function POST() {
  try {
    const prompt = `당신은 프로젝트 개선 컨설턴트입니다. 이 프로젝트의 코드베이스를 분석하여 개선이 필요한 항목 5~8개를 추천해주세요.

각 항목은 다음 카테고리 중 하나에 해당해야 합니다:
- bug: 버그 수정
- refactor: 코드 리팩토링
- performance: 성능 최적화
- test: 테스트 보강
- docs: 문서화
- ux: UX/UI 개선
- security: 보안 개선
- cleanup: 코드 정리

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:

{
  "suggestions": [
    {
      "title": "간결한 제목",
      "description": "무엇을 왜 개선해야 하는지 2-3문장",
      "category": "bug",
      "priority": "high",
      "scope": ["src/frontend/src/components/Example.tsx"],
      "effort": "small"
    }
  ]
}

effort는 "small"(30분 이내), "medium"(1-2시간), "large"(반나절 이상) 중 하나.
priority는 "high", "medium", "low" 중 하나.
scope는 관련 파일 경로 배열.

실제 코드를 확인하고, 구체적이고 실행 가능한 개선안만 제안하세요.`;

    const result = execSync(
      `echo ${JSON.stringify(prompt)} | claude --output-format json --dangerously-skip-permissions`,
      {
        cwd: PROJECT_ROOT,
        encoding: "utf-8",
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const parsed = JSON.parse(result);
    const text = parsed.result || "";

    // JSON 추출
    const jsonMatch = text.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ suggestions: [], error: "추천 결과를 파싱할 수 없습니다." });
    }

    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ suggestions: [], error: msg }, { status: 500 });
  }
}
