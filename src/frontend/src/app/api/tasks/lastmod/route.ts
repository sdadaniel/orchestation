import { NextResponse } from "next/server";
import { getDb } from "@/service/db";

export const dynamic = "force-dynamic";

/** 가벼운 엔드포인트 — tasks 테이블의 최신 수정 시간만 반환 */
export async function GET() {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ lastMod: 0 });
    }

    const row = db
      .prepare("SELECT MAX(updated) as maxUpdated FROM tasks")
      .get() as { maxUpdated: string | null } | undefined;
    if (!row?.maxUpdated) {
      return NextResponse.json({ lastMod: 0 });
    }

    // updated is stored as ISO string, convert to epoch ms
    const lastMod = new Date(row.maxUpdated).getTime();
    return NextResponse.json({ lastMod: Math.floor(lastMod) });
  } catch {
    return NextResponse.json({ lastMod: 0 });
  }
}
