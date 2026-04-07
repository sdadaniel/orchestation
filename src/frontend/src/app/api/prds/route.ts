import { NextResponse } from "next/server";
import { parseAllPrds } from "@/parser/prd-parser";

export const dynamic = "force-dynamic";

export async function GET() {
  const prds = parseAllPrds();
  return NextResponse.json(prds);
}
