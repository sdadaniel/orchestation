import fs from "fs";
import { TASKS_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

// 마지막 변경 시각을 서버 메모리에 유지
let lastChangedAt = Date.now();

// fs.watch는 서버 시작 시 1회만 설정
let watcherInitialized = false;

function initWatcher() {
  if (watcherInitialized) return;
  watcherInitialized = true;

  try {
    fs.watch(TASKS_DIR, { recursive: true }, (_event, filename) => {
      if (!filename?.endsWith(".md")) return;
      lastChangedAt = Date.now();
    });
  } catch {
    // TASKS_DIR 없으면 무시
  }
}

/** GET /api/tasks/watch — 마지막 변경 시각 반환 (polling 방식) */
export async function GET(request: Request) {
  initWatcher();

  const { searchParams } = new URL(request.url);
  const since = parseInt(searchParams.get("since") || "0", 10);

  return Response.json({
    changed: lastChangedAt > since,
    lastChangedAt,
  });
}
