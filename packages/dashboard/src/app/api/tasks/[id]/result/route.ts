import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { OUTPUT_DIR } from "@/lib/config/paths";
import { getTaskLookupKeys, resolveTaskRef } from "@/service/task-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = resolveTaskRef(id)?.task;
  const taskKeys = getTaskLookupKeys(task ?? id);

  // task 결과만 읽기 (review 결과는 사용하지 않음)
  const taskPath = taskKeys
    .map((taskKey) => path.join(OUTPUT_DIR, `${taskKey}-task.json`))
    .find((filePath) => fs.existsSync(filePath));

  if (!taskPath) {
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
    const rejectionPath = taskKeys
      .map((taskKey) => path.join(OUTPUT_DIR, `${taskKey}-rejection-reason.txt`))
      .find((filePath) => fs.existsSync(filePath));
    if (rejectionPath) {
      status = "rejected";
    }

    // review 피드백 (실패 시 사유 표시용)
    let reviewFeedback: string | null = null;
    const feedbackPath = taskKeys
      .map((taskKey) => path.join(OUTPUT_DIR, `${taskKey}-review-feedback.txt`))
      .find((filePath) => fs.existsSync(filePath));
    if (feedbackPath) {
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
