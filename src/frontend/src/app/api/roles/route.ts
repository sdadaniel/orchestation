import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { PROJECT_ROOT } from "@/lib/paths";

export const dynamic = "force-dynamic";

/** GET /api/roles — docs/roles/ 폴더에서 사용 가능한 worker role 목록 반환 */
export async function GET() {
  try {
    const rolesDir = path.join(PROJECT_ROOT, "docs", "roles");
    const roles = fs.readdirSync(rolesDir)
      .filter((f) => f.endsWith(".md") && !f.startsWith("reviewer-") && f !== "README.md")
      .map((f) => f.replace(".md", ""));
    return NextResponse.json(roles);
  } catch {
    return NextResponse.json(["general"]);
  }
}
