import Database from "better-sqlite3";
import { resolve } from "path";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { PROJECT_ROOT, DB_DIR } from "../lib/config/paths";
import { parseNoticeFile, getNoticesDir } from "../parser/notice-parser";

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

    // tasks.phase (fine-grained status; e.g. working/reviewing)
    addColumn("tasks", "phase TEXT");
    addColumn("tasks", "display_id TEXT");
    addColumn("tasks", "display_number INTEGER");
    addColumn("tasks", "legacy_task_key TEXT");
    addColumn("notices", "display_id TEXT");
    addColumn("notices", "display_number INTEGER");
    addColumn("notices", "legacy_notice_key TEXT");
    addColumn("notices", "read INTEGER DEFAULT 0");
    addColumn("notices", "updated TEXT");

    try {
      db.exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_display_id ON tasks(display_id)",
      );
      db.exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_display_number ON tasks(display_number)",
      );
      db.exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_legacy_task_key ON tasks(legacy_task_key)",
      );
      db.exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_notices_display_id ON notices(display_id)",
      );
      db.exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_notices_legacy_notice_key ON notices(legacy_notice_key)",
      );
    } catch {
      // ignore index creation failures on partially migrated DBs
    }

    try {
      const rows = db
        .prepare(
          "SELECT id, display_id, display_number, legacy_task_key FROM tasks",
        )
        .all() as Array<{
        id: string;
        display_id?: string | null;
        display_number?: number | null;
        legacy_task_key?: string | null;
      }>;

      const updateDisplay = db.prepare(
        "UPDATE tasks SET display_id = ?, display_number = ? WHERE id = ?",
      );

      for (const row of rows) {
        if (row.display_id && row.display_number !== null && row.display_number !== undefined) {
          continue;
        }

        const match = row.id.match(/^TASK-(\d+)$/i);
        if (!match) continue;
        const displayNumber = parseInt(match[1] ?? "", 10);
        if (!Number.isFinite(displayNumber)) continue;
        const displayId = `TASK-${String(displayNumber).padStart(3, "0")}`;
        updateDisplay.run(displayId, displayNumber, row.id);
      }
    } catch {
      // ignore backfill errors; new rows will still populate the columns
    }

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

    try {
      const legacyRows = db
        .prepare(
          "SELECT id, display_id, display_number, legacy_task_key FROM tasks WHERE legacy_task_key IS NULL",
        )
        .all() as Array<{
        id: string;
        display_id?: string | null;
        display_number?: number | null;
        legacy_task_key?: string | null;
      }>;

      const migratable: Array<{
        oldId: string;
        newId: string;
        displayId: string;
        displayNumber: number;
      }> = [];

      for (const row of legacyRows) {
        const match = row.id.match(/^TASK-(\d+)$/i);
        if (!match) continue;
        const displayNumber = parseInt(match[1] ?? "", 10);
        if (!Number.isFinite(displayNumber)) continue;
        migratable.push({
          oldId: row.id,
          newId: crypto.randomUUID(),
          displayId:
            row.display_id || `TASK-${String(displayNumber).padStart(3, "0")}`,
          displayNumber,
        });
      }

      if (migratable.length > 0) {
        const mapping = new Map(
          migratable.map((row) => [row.oldId, row.newId] as const),
        );

        const parseJsonArray = (value: string | null): string[] => {
          if (!value) return [];
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map(String) : [];
          } catch {
            return [];
          }
        };

        const txn = db.transaction(() => {
          const updateTaskIdentity = db.prepare(
            "UPDATE tasks SET id = ?, display_id = ?, display_number = ?, legacy_task_key = ? WHERE id = ?",
          );
          const selectSteps = db.prepare(
            "SELECT id, step_key FROM task_steps WHERE task_id = ?",
          );
          const updateTaskStep = db.prepare(
            "UPDATE task_steps SET id = ?, task_id = ? WHERE id = ?",
          );
          const updateTaskEventsTaskId = db.prepare(
            "UPDATE task_events SET task_id = ? WHERE task_id = ?",
          );
          const updateTokenUsageTaskId = db.prepare(
            "UPDATE token_usage SET task_id = ? WHERE task_id = ?",
          );
          const updateConversationsTaskId = db.prepare(
            "UPDATE conversations SET task_id = ? WHERE task_id = ?",
          );
          const updateTaskEventsStepId = db.prepare(
            "UPDATE task_events SET step_id = ? WHERE step_id = ?",
          );
          const updateTokenUsageStepId = db.prepare(
            "UPDATE token_usage SET step_id = ? WHERE step_id = ?",
          );
          const updateConversationsStepId = db.prepare(
            "UPDATE conversations SET step_id = ? WHERE step_id = ?",
          );

          for (const row of migratable) {
            const steps = selectSteps.all(row.oldId) as Array<{
              id: string;
              step_key: string;
            }>;

            updateTaskIdentity.run(
              row.newId,
              row.displayId,
              row.displayNumber,
              row.oldId,
              row.oldId,
            );
            updateTaskEventsTaskId.run(row.newId, row.oldId);
            updateTokenUsageTaskId.run(row.newId, row.oldId);
            updateConversationsTaskId.run(row.newId, row.oldId);

            for (const step of steps) {
              const newStepId = `${row.newId}:${step.step_key}`;
              updateTaskStep.run(newStepId, row.newId, step.id);
              updateTaskEventsStepId.run(newStepId, step.id);
              updateTokenUsageStepId.run(newStepId, step.id);
              updateConversationsStepId.run(newStepId, step.id);
            }
          }

          const taskRows = db
            .prepare("SELECT id, depends_on FROM tasks")
            .all() as Array<{ id: string; depends_on: string | null }>;
          const updateDependsOn = db.prepare(
            "UPDATE tasks SET depends_on = ? WHERE id = ?",
          );
          for (const row of taskRows) {
            const current = parseJsonArray(row.depends_on);
            const rewritten = current.map((id) => mapping.get(id) ?? id);
            if (JSON.stringify(current) !== JSON.stringify(rewritten)) {
              updateDependsOn.run(JSON.stringify(rewritten), row.id);
            }
          }

          const runRows = db
            .prepare("SELECT id, task_results FROM run_history")
            .all() as Array<{ id: string; task_results: string | null }>;
          const updateRunHistory = db.prepare(
            "UPDATE run_history SET task_results = ? WHERE id = ?",
          );
          for (const row of runRows) {
            let parsed: Array<{ taskId?: string; status?: string }> = [];
            try {
              const value = JSON.parse(row.task_results ?? "[]");
              if (Array.isArray(value)) parsed = value;
            } catch {
              parsed = [];
            }
            const rewritten = parsed.map((entry) => ({
              ...entry,
              taskId:
                typeof entry.taskId === "string"
                  ? (mapping.get(entry.taskId) ?? entry.taskId)
                  : entry.taskId,
            }));
            if (JSON.stringify(parsed) !== JSON.stringify(rewritten)) {
              updateRunHistory.run(JSON.stringify(rewritten), row.id);
            }
          }
        });
        db.pragma("foreign_keys = OFF");
        try {
          txn();
        } finally {
          db.pragma("foreign_keys = ON");
        }
      }
    } catch {
      // ignore migration errors; startup should remain non-destructive
    }

    try {
      const noticeColumns = db.pragma("table_info(notices)") as Array<{
        name: string;
        type: string;
      }>;
      const noticeColumnNames = new Set(noticeColumns.map((column) => column.name));
      const noticeIdColumn = noticeColumns.find((column) => column.name === "id");
      const needsNoticeRebuild =
        !!noticeIdColumn &&
        (noticeIdColumn.type.toUpperCase() !== "TEXT" ||
          noticeColumnNames.has("canonical_id") ||
          noticeColumnNames.has("notice_id"));

      if (needsNoticeRebuild) {
        const oldRows = db.prepare("SELECT * FROM notices").all() as Array<
          Record<string, unknown>
        >;

        db.exec(`
          CREATE TABLE IF NOT EXISTS notices_v2 (
            id TEXT PRIMARY KEY,
            display_id TEXT UNIQUE,
            display_number INTEGER UNIQUE,
            legacy_notice_key TEXT UNIQUE,
            title TEXT,
            content TEXT,
            type TEXT DEFAULT 'info',
            read INTEGER DEFAULT 0,
            created TEXT DEFAULT (datetime('now','localtime')),
            updated TEXT DEFAULT (datetime('now','localtime'))
          )
        `);

        const insertNotice = db.prepare(
          `INSERT INTO notices_v2
            (id, display_id, display_number, legacy_notice_key, title, content, type, read, created, updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );

        for (const row of oldRows) {
          const rawId = typeof row.id === "string" ? row.id : null;
          const displayId =
            (typeof row.display_id === "string" && row.display_id) ||
            (typeof row.notice_id === "string" && row.notice_id) ||
            (typeof row.legacy_notice_key === "string" && row.legacy_notice_key) ||
            (rawId && /^NOTICE-\d+$/i.test(rawId) ? rawId : null);
          const displayNumber =
            typeof row.display_number === "number"
              ? row.display_number
              : displayId
                ? parseInt(displayId.replace(/^NOTICE-/i, ""), 10)
                : null;
          const canonicalId =
            (typeof row.canonical_id === "string" && row.canonical_id) ||
            (rawId && !/^NOTICE-\d+$/i.test(rawId) ? rawId : null) ||
            crypto.randomUUID();
          const legacyNoticeKey =
            (typeof row.legacy_notice_key === "string" && row.legacy_notice_key) ||
            (typeof row.notice_id === "string" && row.notice_id) ||
            (rawId && /^NOTICE-\d+$/i.test(rawId) ? rawId : null) ||
            displayId;

          insertNotice.run(
            canonicalId,
            displayId,
            Number.isFinite(displayNumber) ? displayNumber : null,
            legacyNoticeKey,
            typeof row.title === "string" ? row.title : null,
            typeof row.content === "string" ? row.content : null,
            typeof row.type === "string" ? row.type : "info",
            typeof row.read === "number" ? row.read : 0,
            typeof row.created === "string" ? row.created : null,
            typeof row.updated === "string"
              ? row.updated
              : typeof row.created === "string"
                ? row.created
                : null,
          );
        }

        db.exec("DROP TABLE notices");
        db.exec("ALTER TABLE notices_v2 RENAME TO notices");
        db.exec(
          "CREATE UNIQUE INDEX IF NOT EXISTS idx_notices_display_id ON notices(display_id)",
        );
        db.exec(
          "CREATE UNIQUE INDEX IF NOT EXISTS idx_notices_legacy_notice_key ON notices(legacy_notice_key)",
        );
      }

      const noticesDir = getNoticesDir();
      if (fs.existsSync(noticesDir)) {
        const files = fs
          .readdirSync(noticesDir)
          .filter((file) => file.startsWith("NOTICE-") && file.endsWith(".md"));
        const existsStmt = db.prepare(
          "SELECT id FROM notices WHERE display_id = ? OR legacy_notice_key = ? LIMIT 1",
        );
        const insertStmt = db.prepare(
          `INSERT INTO notices
            (id, display_id, display_number, legacy_notice_key, title, content, type, read, created, updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );

        for (const file of files) {
          const notice = parseNoticeFile(path.join(noticesDir, file));
          if (!notice) continue;
          const displayId = notice.display_id || notice.id;
          const match = displayId.match(/^NOTICE-(\d+)$/i);
          const displayNumber = match ? parseInt(match[1] ?? "", 10) : null;
          const exists = existsStmt.get(displayId, notice.id) as
            | { id: string }
            | undefined;
          if (exists) continue;
          insertStmt.run(
            crypto.randomUUID(),
            displayId,
            displayNumber,
            notice.id,
            notice.title,
            notice.content,
            notice.type,
            notice.read ? 1 : 0,
            notice.created,
            notice.updated || notice.created,
          );
        }
      }
    } catch {
      // ignore notice migration errors; file fallback remains available
    }
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
