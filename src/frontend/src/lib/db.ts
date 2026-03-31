import Database from "better-sqlite3";
import { resolve } from "path";
import fs from "fs";

const PROJECT_ROOT = resolve(process.cwd(), "../..");
const DB_PATH = resolve(PROJECT_ROOT, ".orchestration", "orchestration.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database | null {
  if (!fs.existsSync(DB_PATH)) return null;
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: true });
  }
  return _db;
}

export function closeDb() {
  _db?.close();
  _db = null;
}

// Helper: check if SQLite DB exists and has data
export function isDbAvailable(): boolean {
  const db = getDb();
  if (!db) return false;
  try {
    const row = db.prepare("SELECT COUNT(*) as cnt FROM tasks").get() as { cnt: number };
    return row.cnt > 0;
  } catch {
    return false;
  }
}
