import { NextResponse } from "next/server";
import { parseCostLog } from "@/parser/cost-parser";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = parseCostLog();
  return NextResponse.json(data);
}
