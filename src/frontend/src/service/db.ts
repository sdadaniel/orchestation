import Database from "better-sqlite3";
import { resolve } from "path";
import fs from "fs";
import { PROJECT_ROOT, DB_DIR } from "../lib/paths";

const DB_PATH = resolve(DB_DIR, "orchestration.db");
const SCHEMA_PATH = resolve(PROJECT_ROOT, "scripts", "lib", "schema.sql");

let _readonlyDb: Database.Database | null = null;
let _writableDb: Database.Database | null = null;
let _initialized = false;

function ensureDb(): void {
  if (_initialized) return;
  _initialized = true;

  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  if (!fs.existsSync(DB_PATH)) {
    // DB가 없으면 생성 + 스키마 초기화
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    if (fs.existsSync(SCHEMA_PATH)) {
      db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));
    }
    db.close();
  }
}

export function getDb(): Database.Database | null {
  ensureDb();
  if (!fs.existsSync(DB_PATH)) return null;
  if (!_readonlyDb) {
    _readonlyDb = new Database(DB_PATH, { readonly: true });
  }
  return _readonlyDb;
}

export function getWritableDb(): Database.Database | null {
  ensureDb();
  if (!fs.existsSync(DB_PATH)) return null;
  if (!_writableDb) {
    _writableDb = new Database(DB_PATH);
    _writableDb.pragma("journal_mode = WAL");
  }
  return _writableDb;
}

export function closeDb() {
  _readonlyDb?.close();
  _readonlyDb = null;
  _writableDb?.close();
  _writableDb = null;
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
