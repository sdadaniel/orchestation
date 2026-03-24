import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const OUTPUT_DIR = path.join(process.cwd(), "../../output");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // REQ-XXX → TASK-XXX
  const taskId = id.replace(/^REQ-/, "TASK-");

  // review 결과 우선, 없으면 task 결과
  const reviewPath = path.join(OUTPUT_DIR, `${taskId}-review.json`);
  const taskPath = path.join(OUTPUT_DIR, `${taskId}-task.json`);

  const filePath = fs.existsSync(reviewPath)
    ? reviewPath
    : fs.existsSync(taskPath)
      ? taskPath
      : null;

  if (!filePath) {
    return NextResponse.json({ result: null });
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const json = JSON.parse(raw);
    const result: string = json.result ?? "";

    // 3줄 요약: 총평 섹션 추출, 없으면 마지막 3줄
    const summary = extractSummary(result);

    return NextResponse.json({ result: summary, source: filePath.includes("-review") ? "review" : "task" });
  } catch {
    return NextResponse.json({ result: null });
  }
}

function extractSummary(text: string): string {
  // "### 총평" 섹션 찾기
  const summaryMatch = text.match(/###\s*총평\s*\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (summaryMatch) {
    return summaryMatch[1].trim();
  }

  // "## 리뷰 결과" 라인 찾기
  const resultMatch = text.match(/##\s*리뷰 결과[^\n]*/);
  if (resultMatch) {
    // 리뷰 결과 라인 + 이후 내용에서 핵심 3줄
    const idx = text.indexOf(resultMatch[0]);
    const after = text.slice(idx).split("\n").filter((l) => l.trim()).slice(0, 4);
    return after.join("\n");
  }

  // fallback: 마지막 의미있는 3줄
  const lines = text.split("\n").filter((l) => l.trim());
  return lines.slice(-3).join("\n");
}
