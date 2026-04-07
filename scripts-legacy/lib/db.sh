#!/bin/bash
# db.sh — SQLite helper functions for orchestration
# Source this file after setting PROJECT_ROOT

DB_FILE="${PROJECT_ROOT:-.}/.orchestration/orchestration.db"
SCHEMA_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/schema.sql"

# ── Core ──────────────────────────────────────────────

# Initialize DB from schema (idempotent — all CREATE IF NOT EXISTS)
db_init() {
  if [ ! -f "$SCHEMA_FILE" ]; then
    echo "[db] ERROR: schema.sql not found at $SCHEMA_FILE" >&2
    return 1
  fi
  mkdir -p "$(dirname "$DB_FILE")"
  sqlite3 "$DB_FILE" < "$SCHEMA_FILE"
}

# Run a query (SELECT — returns rows)
db_query() {
  sqlite3 "$DB_FILE" "$1"
}

# Run a statement (INSERT/UPDATE/DELETE — no output expected)
db_exec() {
  sqlite3 "$DB_FILE" "$1"
}

# ── Task helpers ──────────────────────────────────────

db_task_exists() {
  local count
  count=$(db_query "SELECT count(*) FROM tasks WHERE id='$1';")
  [ "$count" -gt 0 ]
}

db_get_task_status() {
  db_query "SELECT status FROM tasks WHERE id='$1';"
}

db_set_task_status() {
  local task_id="$1"
  local new_status="$2"
  local old_status
  old_status=$(db_get_task_status "$task_id")
  db_exec "UPDATE tasks SET status='$new_status', updated=datetime('now','localtime') WHERE id='$task_id';"
  if [ -n "$old_status" ] && [ "$old_status" != "$new_status" ]; then
    db_exec "INSERT INTO task_events(task_id, event_type, from_status, to_status) VALUES('$task_id', 'status_change', '$old_status', '$new_status');"
  fi
}

db_get_task_field() {
  local task_id="$1"
  local field="$2"
  # Whitelist allowed fields to prevent injection
  case "$field" in
    id|title|status|priority|branch|worktree|role|reviewer_role|scope|context|depends_on|complexity|sort_order|content|created|updated)
      db_query "SELECT $field FROM tasks WHERE id='$task_id';"
      ;;
    *)
      echo "[db] ERROR: unknown field '$field'" >&2
      return 1
      ;;
  esac
}

db_get_pending_tasks() {
  db_query "SELECT id FROM tasks WHERE status='pending' ORDER BY sort_order, id;"
}

db_get_tasks_by_status() {
  local status="$1"
  db_query "SELECT id FROM tasks WHERE status='$status' ORDER BY sort_order, id;"
}

# ── Event helpers ─────────────────────────────────────

db_insert_event() {
  local task_id="$1"
  local event_type="$2"
  local detail="$3"
  # Escape single quotes in detail
  detail=$(echo "$detail" | sed "s/'/''/g")
  db_exec "INSERT INTO task_events(task_id, event_type, detail) VALUES('$task_id', '$event_type', '$detail');"
}

# ── Token usage helpers ───────────────────────────────

db_insert_token_usage() {
  local task_id="$1"
  local phase="$2"
  local model="$3"
  local input_tokens="$4"
  local cache_create="$5"
  local cache_read="$6"
  local output_tokens="$7"
  local turns="$8"
  local duration_ms="$9"
  shift 9
  local cost_usd="$1"
  local ts="$2"
  if [ -n "$ts" ]; then
    db_exec "INSERT INTO token_usage(task_id, phase, model, input_tokens, cache_create, cache_read, output_tokens, turns, duration_ms, cost_usd, timestamp) VALUES('$task_id', '$phase', '$model', $input_tokens, $cache_create, $cache_read, $output_tokens, $turns, $duration_ms, $cost_usd, '$ts');"
  else
    db_exec "INSERT INTO token_usage(task_id, phase, model, input_tokens, cache_create, cache_read, output_tokens, turns, duration_ms, cost_usd) VALUES('$task_id', '$phase', '$model', $input_tokens, $cache_create, $cache_read, $output_tokens, $turns, $duration_ms, $cost_usd);"
  fi
}

# ── Notice helpers ────────────────────────────────────

db_insert_notice() {
  local notice_id="$1"
  local title="$2"
  local content="$3"
  local ntype="${4:-info}"
  local created="$5"
  # Escape single quotes
  title=$(echo "$title" | sed "s/'/''/g")
  content=$(echo "$content" | sed "s/'/''/g")
  if [ -n "$created" ]; then
    db_exec "INSERT OR REPLACE INTO notices(notice_id, title, content, type, created) VALUES('$notice_id', '$title', '$content', '$ntype', '$created');"
  else
    db_exec "INSERT OR REPLACE INTO notices(notice_id, title, content, type) VALUES('$notice_id', '$title', '$content', '$ntype');"
  fi
}
