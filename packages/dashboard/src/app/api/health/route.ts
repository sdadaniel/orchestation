import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { PROJECT_ROOT, PACKAGE_DIR, DB_DIR } from "@/lib/config/paths";

export const dynamic = "force-dynamic";

const DB_FILE = path.join(DB_DIR, "orchestration.db");

export async function GET() {
  const orchestrationDir = path.join(PROJECT_ROOT, ".orchestration");
  const orchDirExists = fs.existsSync(orchestrationDir);
  const dbFileExists = fs.existsSync(DB_FILE);

  let dbOpenable = false;
  if (dbFileExists) {
    try {
      const db = new Database(DB_FILE, { readonly: true });
      db.prepare("SELECT 1").get();
      db.close();
      dbOpenable = true;
    } catch {
      dbOpenable = false;
    }
  }

  const body = {
    ok: true,
    cwd: process.cwd(),
    port: process.env.PORT ?? null,
    projectRoot: PROJECT_ROOT,
    packageDir: PACKAGE_DIR,
    envProjectRootSet: Boolean(process.env.PROJECT_ROOT),
    envPackageDirSet: Boolean(process.env.PACKAGE_DIR),
    orchestrationDirExists: orchDirExists,
    dbFileExists,
    dbOpenable,
  };

  return NextResponse.json(body);
}
