import { NextResponse } from "next/server";
import { parseAllSprints } from "@/lib/sprint-parser";

export const dynamic = "force-dynamic";

export async function GET() {
  const sprints = parseAllSprints();
  return NextResponse.json(sprints);
}
