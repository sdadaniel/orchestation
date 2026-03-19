import { NextResponse } from "next/server";
import { parseAllTasks } from "@/lib/parser";

export const dynamic = "force-dynamic";

export async function GET() {
  const tasks = parseAllTasks();
  return NextResponse.json(tasks);
}
