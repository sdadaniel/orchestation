import { NextResponse } from "next/server";
import { parseAllPlans } from "@/parser/plan-parser";

export const dynamic = "force-dynamic";

export async function GET() {
  const plans = parseAllPlans();
  return NextResponse.json(plans);
}
