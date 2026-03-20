import { NextResponse } from "next/server";
import { parseAllPlans } from "@/lib/plan-parser";

export const dynamic = "force-dynamic";

export async function GET() {
  const plans = parseAllPlans();
  return NextResponse.json(plans);
}
