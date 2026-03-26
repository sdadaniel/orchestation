import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projectRoot = path.resolve(process.cwd(), "..", "..");
    const output = execSync("git branch --format='%(refname:short)'", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 5000,
    });
    const branches = output
      .split("\n")
      .map((b: string) => b.trim().replace(/^'|'$/g, ""))
      .filter((b: string) => b.length > 0 && !b.startsWith("task/"));
    return NextResponse.json({ branches });
  } catch {
    return NextResponse.json({ branches: [] });
  }
}
