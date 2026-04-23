import Database from "better-sqlite3";
import { resolve } from "path";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PROJECT_ROOT, DB_DIR } from "../lib/config/paths";

const DB_PATH = resolve(DB_DIR, "orchestration.db");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(__dirname, "schema.sql");

let _readonlyDb: Database.Database | null = null;
let _writableDb: Database.Database | null = null;
let _initialized = false;

function ensureDb(): void {
  if (_initialized) return;
  _initialized = true;

  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  const isNew = !fs.existsSync(DB_PATH);
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  if (isNew && fs.existsSync(SCHEMA_PATH)) {
    db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));
  } else if (!isNew) {
    // Migrate: create missing tables / columns on existing DBs
    const schema = fs.existsSync(SCHEMA_PATH)
      ? fs.readFileSync(SCHEMA_PATH, "utf-8")
      : "";

    // 1) Ensure tables exist (CREATE TABLE IF NOT EXISTS)
    if (schema) {
      const createOnly = schema
        .split(";\n")
        .filter((stmt) => stmt.trim().toUpperCase().startsWith("CREATE TABLE"))
        .join(";\n");
      if (createOnly.trim()) db.exec(createOnly + ";\n");
    }

    // 2) Ensure new columns exist (SQLite has no ADD COLUMN IF NOT EXISTS)
    function hasColumn(table: string, col: string): boolean {
      try {
        const rows = db.pragma(`table_info(${table})`) as Array<{
          name: string;
        }>;
        return rows.some((r) => r.name === col);
      } catch {
        return false;
      }
    }

    function addColumn(table: string, colDef: string) {
      const colName = colDef.trim().split(/\s+/)[0] ?? "";
      if (!colName) return;
      if (hasColumn(table, colName)) return;
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
    }

    // task_events.step_id / token_usage.step_id / conversations.step_id
    addColumn("task_events", "step_id TEXT");
    addColumn("token_usage", "step_id TEXT");
    addColumn("conversations", "step_id TEXT");

    // task_steps table might exist only on newer installs: create if missing
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_steps (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        step_key TEXT NOT NULL,
        step_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempt INTEGER DEFAULT 0,
        max_attempts INTEGER,
        inputs TEXT DEFAULT '{}',
        outputs TEXT DEFAULT '{}',
        started_at TEXT,
        finished_at TEXT,
        created TEXT DEFAULT (datetime('now','localtime')),
        updated TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);
  }

  db.close();
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
    const row = db.prepare("SELECT COUNT(*) as cnt FROM tasks").get() as {
      cnt: number;
    };
    return row.cnt > 0;
  } catch {
    return false;
  }
}
