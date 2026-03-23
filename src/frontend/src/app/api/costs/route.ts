import { NextResponse } from "next/server";
import { parseCostLog } from "@/lib/cost-parser";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = parseCostLog();
  return NextResponse.json(data);
}
