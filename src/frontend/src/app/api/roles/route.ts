import fs from "fs";
import { NextResponse } from "next/server";
import { ROLES_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

/** GET /api/roles — docs/roles/ 폴더에서 사용 가능한 worker role 목록 반환 */
export async function GET() {
  try {
    const rolesDir = ROLES_DIR;
    const roles = fs.readdirSync(rolesDir)
      .filter((f) => f.endsWith(".md") && !f.startsWith("reviewer-") && f !== "README.md")
      .map((f) => f.replace(".md", ""));
    return NextResponse.json(roles);
  } catch {
    return NextResponse.json(["general"]);
  }
}
