import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { TASKS_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

/** 가벼운 엔드포인트 — task 디렉토리의 최신 수정 시간만 반환 */
export async function GET() {
  try {
    if (!fs.existsSync(TASKS_DIR)) {
      return NextResponse.json({ lastMod: 0 });
    }

    const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith(".md"));
    let maxMtime = 0;

    for (const file of files) {
      const stat = fs.statSync(path.join(TASKS_DIR, file));
      if (stat.mtimeMs > maxMtime) maxMtime = stat.mtimeMs;
    }

    return NextResponse.json({ lastMod: Math.floor(maxMtime) });
  } catch {
    return NextResponse.json({ lastMod: 0 });
  }
}
