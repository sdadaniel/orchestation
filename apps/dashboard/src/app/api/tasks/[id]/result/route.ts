import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { OUTPUT_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const taskId = id.replace(/^REQ-/, "TASK-");

  // task 결과만 읽기 (review 결과는 사용하지 않음)
  const taskPath = path.join(OUTPUT_DIR, `${taskId}-task.json`);

  if (!fs.existsSync(taskPath)) {
    return NextResponse.json({ status: null, result: null });
  }

  try {
    const raw = fs.readFileSync(taskPath, "utf-8");
    const json = JSON.parse(raw);
    const result: string = json.result ?? "";

    // rejected 여부 판단: JSON status 또는 "거절:" 키워드
    let status = "done";
    try {
      const parsed = JSON.parse(result);
      if (parsed.status === "rejected") status = "rejected";
    } catch {
      if (result.trim().startsWith("거절:")) status = "rejected";
    }

    // rejection reason 파일이 있으면 rejected
    const rejectionPath = path.join(
      OUTPUT_DIR,
      `${taskId}-rejection-reason.txt`,
    );
    if (fs.existsSync(rejectionPath)) {
      status = "rejected";
    }

    // review 피드백 (실패 시 사유 표시용)
    let reviewFeedback: string | null = null;
    const feedbackPath = path.join(OUTPUT_DIR, `${taskId}-review-feedback.txt`);
    if (fs.existsSync(feedbackPath)) {
      try {
        reviewFeedback = fs.readFileSync(feedbackPath, "utf-8").trim();
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({ status, result, reviewFeedback });
  } catch {
    return NextResponse.json({ status: null, result: null });
  }
}
