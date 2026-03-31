#!/usr/bin/env bash
# migrate-to-sqlite.sh — Migrate file-based orchestration state to SQLite
# Safe to run multiple times (idempotent via INSERT OR REPLACE / DROP+recreate for logs)
set -euo pipefail

PROJ_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PROJECT_ROOT="$PROJ_ROOT"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/db.sh
source "$SCRIPT_DIR/lib/db.sh"

ORCH_DIR="$PROJ_ROOT/.orchestration"
DB_FILE="$ORCH_DIR/orchestration.db"
TASKS_DIR="$ORCH_DIR/tasks"
NOTICES_DIR="$ORCH_DIR/notices"
OUTPUT_DIR="$ORCH_DIR/output"
TOKEN_LOG="$OUTPUT_DIR/token-usage.log"

echo "=== Orchestration File -> SQLite Migration ==="
echo "Project root: $PROJ_ROOT"
echo "Database:     $DB_FILE"
echo ""

# ── 1. Initialize database ──────────────────────────
echo "[1/5] Initializing database schema..."
db_init
echo "  Done."

# ── Counters ─────────────────────────────────────────
task_count=0
task_errors=0
notice_count=0
notice_errors=0
token_count=0
token_errors=0
conv_count=0
conv_errors=0

# ── 2. Migrate tasks ────────────────────────────────
echo ""
echo "[2/5] Migrating tasks..."

for task_file in "$TASKS_DIR"/*.md; do
  [ -f "$task_file" ] || continue

  # Parse YAML frontmatter
  in_frontmatter=0
  id="" title="" status="pending" priority="medium" branch="" worktree=""
  role="general" reviewer_role="" scope="[]" context="[]" depends_on="[]"
  complexity="" sort_order="0" content="" created="" updated=""
  past_frontmatter=0
  last_list_key=""

  while IFS= read -r line; do
    if [ "$past_frontmatter" = "1" ]; then
      content="${content}${line}
"
      continue
    fi

    if [ "$line" = "---" ]; then
      if [ "$in_frontmatter" = "0" ]; then
        in_frontmatter=1
        continue
      else
        # Close any open list fields
        past_frontmatter=1
        continue
      fi
    fi

    if [ "$in_frontmatter" = "1" ]; then
      # Check if this is a YAML list item (    - value)
      case "$line" in
        "    - "*)
          item="${line#    - }"
          case "$last_list_key" in
            scope)
              if [ "$scope" = "[" ]; then
                scope="[\"$item\""
              else
                scope="${scope},\"$item\""
              fi
              ;;
            context)
              if [ "$context" = "[" ]; then
                context="[\"$item\""
              else
                context="${context},\"$item\""
              fi
              ;;
            depends_on)
              if [ "$depends_on" = "[" ]; then
                depends_on="[\"$item\""
              else
                depends_on="${depends_on},\"$item\""
              fi
              ;;
          esac
          continue
          ;;
      esac

      # Regular key: value line
      key="${line%%:*}"
      val="${line#*: }"
      # Trim whitespace
      val="$(echo "$val" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')"

      # Close previous list if switching keys
      if [ -n "$last_list_key" ] && [ "$key" != "$last_list_key" ]; then
        case "$last_list_key" in
          scope)    [ "$scope" != "[]" ] && ! echo "$scope" | grep -q '\]$' && scope="${scope}]" ;;
          context)  [ "$context" != "[]" ] && ! echo "$context" | grep -q '\]$' && context="${context}]" ;;
          depends_on) [ "$depends_on" != "[]" ] && ! echo "$depends_on" | grep -q '\]$' && depends_on="${depends_on}]" ;;
        esac
        last_list_key=""
      fi

      case "$key" in
        id) id="$val" ;;
        title) title="$val" ;;
        status) status="$val" ;;
        priority) priority="$val" ;;
        branch) branch="$val" ;;
        worktree) worktree="$val" ;;
        role) role="$val" ;;
        reviewer_role) reviewer_role="$val" ;;
        complexity) complexity="$val" ;;
        sort_order) sort_order="$val" ;;
        created) created="$val" ;;
        updated) updated="$val" ;;
        scope)
          if echo "$val" | grep -q '^\['; then
            scope="$val"
          else
            scope="["
            last_list_key="scope"
          fi
          ;;
        context)
          if echo "$val" | grep -q '^\['; then
            context="$val"
          else
            context="["
            last_list_key="context"
          fi
          ;;
        depends_on)
          if echo "$val" | grep -q '^\['; then
            depends_on="$val"
          else
            depends_on="["
            last_list_key="depends_on"
          fi
          ;;
      esac
    fi
  done < "$task_file"

  # Close any remaining open JSON arrays
  case "$scope" in
    "["*) echo "$scope" | grep -q '\]$' || scope="${scope}]" ;;
  esac
  case "$context" in
    "["*) echo "$context" | grep -q '\]$' || context="${context}]" ;;
  esac
  case "$depends_on" in
    "["*) echo "$depends_on" | grep -q '\]$' || depends_on="${depends_on}]" ;;
  esac

  if [ -z "$id" ]; then
    echo "  [WARN] Skipping $task_file (no id)"
    task_errors=$((task_errors + 1))
    continue
  fi

  # Escape single quotes for SQL
  title_esc="$(echo "$title" | sed "s/'/''/g")"
  content_esc="$(echo "$content" | sed "s/'/''/g")"
  branch_esc="$(echo "$branch" | sed "s/'/''/g")"
  worktree_esc="$(echo "$worktree" | sed "s/'/''/g")"
  scope_esc="$(echo "$scope" | sed "s/'/''/g")"
  context_esc="$(echo "$context" | sed "s/'/''/g")"
  depends_esc="$(echo "$depends_on" | sed "s/'/''/g")"

  # Build created/updated values
  created_val="datetime('now','localtime')"
  [ -n "$created" ] && created_val="'$created'"
  updated_val="datetime('now','localtime')"
  [ -n "$updated" ] && updated_val="'$updated'"

  sqlite3 "$DB_FILE" "INSERT OR REPLACE INTO tasks (id, title, status, priority, branch, worktree, role, reviewer_role, scope, context, depends_on, complexity, sort_order, content, created, updated) VALUES ('$id', '$title_esc', '$status', '$priority', '$branch_esc', '$worktree_esc', '$role', '$reviewer_role', '$scope_esc', '$context_esc', '$depends_esc', '$complexity', $sort_order, '$content_esc', $created_val, $updated_val);" 2>/dev/null || {
    echo "  [ERROR] Failed to insert $id"
    task_errors=$((task_errors + 1))
    continue
  }

  task_count=$((task_count + 1))
done

echo "  -> $task_count tasks migrated ($task_errors errors)"

# ── 3. Migrate notices ───────────────────────────────
echo ""
echo "[3/5] Migrating notices..."

if [ -d "$NOTICES_DIR" ]; then
  for notice_file in "$NOTICES_DIR"/*.md; do
    [ -f "$notice_file" ] || continue

    in_frontmatter=0
    notice_id="" title="" type="info" content="" created=""
    past_frontmatter=0

    while IFS= read -r line; do
      if [ "$past_frontmatter" = "1" ]; then
        content="${content}${line}
"
        continue
      fi

      if [ "$line" = "---" ]; then
        if [ "$in_frontmatter" = "0" ]; then
          in_frontmatter=1
          continue
        else
          past_frontmatter=1
          continue
        fi
      fi

      if [ "$in_frontmatter" = "1" ]; then
        key="${line%%:*}"
        val="${line#*: }"
        val="$(echo "$val" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')"
        case "$key" in
          id) notice_id="$val" ;;
          title) title="$val" ;;
          type) type="$val" ;;
          created) created="$val" ;;
        esac
      fi
    done < "$notice_file"

    if [ -z "$notice_id" ]; then
      # Derive id from filename
      notice_id="$(basename "$notice_file" .md | sed 's/^\(NOTICE-[0-9]*\).*/\1/')"
    fi

    title_esc="$(echo "$title" | sed "s/'/''/g")"
    content_esc="$(echo "$content" | sed "s/'/''/g")"

    if [ -n "$created" ]; then
      sqlite3 "$DB_FILE" "INSERT OR REPLACE INTO notices (notice_id, title, content, type, created) VALUES ('$notice_id', '$title_esc', '$content_esc', '$type', '$created');" 2>/dev/null || {
        echo "  [ERROR] Failed to insert $notice_id"
        notice_errors=$((notice_errors + 1))
        continue
      }
    else
      sqlite3 "$DB_FILE" "INSERT OR REPLACE INTO notices (notice_id, title, content, type) VALUES ('$notice_id', '$title_esc', '$content_esc', '$type');" 2>/dev/null || {
        echo "  [ERROR] Failed to insert $notice_id"
        notice_errors=$((notice_errors + 1))
        continue
      }
    fi

    notice_count=$((notice_count + 1))
  done
fi

echo "  -> $notice_count notices migrated ($notice_errors errors)"

# ── 4. Migrate token usage ───────────────────────────
echo ""
echo "[4/5] Migrating token usage..."

# Clear existing token_usage for idempotency (log file is append-only source of truth)
sqlite3 "$DB_FILE" "DELETE FROM token_usage;"

if [ -f "$TOKEN_LOG" ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue

    # Format: [2026-03-23 12:30:21] TASK-029 | phase=task | model=xxx | input=N cache_create=N cache_read=N output=N | turns=N | duration=Nms | cost=$N
    timestamp="$(echo "$line" | sed 's/^\[\(.*\)\] .*/\1/')"
    task_id="$(echo "$line" | sed 's/^[^]]*\] \([^ ]*\) .*/\1/')"
    phase="$(echo "$line" | sed 's/.*phase=\([^ |]*\).*/\1/')"

    # Model (optional field)
    model=""
    case "$line" in
      *model=*) model="$(echo "$line" | sed 's/.*model=\([^ |]*\).*/\1/')" ;;
    esac

    # Token counts
    input_tokens="$(echo "$line" | sed 's/.*input=\([0-9]*\).*/\1/')"
    cache_create="$(echo "$line" | sed 's/.*cache_create=\([0-9]*\).*/\1/')"
    cache_read="$(echo "$line" | sed 's/.*cache_read=\([0-9]*\).*/\1/')"
    output_tokens="$(echo "$line" | sed 's/.*output=\([0-9]*\).*/\1/')"
    turns="$(echo "$line" | sed 's/.*turns=\([0-9]*\).*/\1/')"
    duration="$(echo "$line" | sed 's/.*duration=\([0-9]*\)ms.*/\1/')"
    cost="$(echo "$line" | sed 's/.*cost=\$\([0-9.]*\).*/\1/')"

    # Validate task_id
    case "$task_id" in
      TASK-*) ;;
      *) token_errors=$((token_errors + 1)); continue ;;
    esac

    # Default missing values
    input_tokens="${input_tokens:-0}"
    cache_create="${cache_create:-0}"
    cache_read="${cache_read:-0}"
    output_tokens="${output_tokens:-0}"
    turns="${turns:-0}"
    duration="${duration:-0}"
    cost="${cost:-0}"

    sqlite3 "$DB_FILE" "INSERT INTO token_usage (task_id, phase, model, input_tokens, cache_create, cache_read, output_tokens, turns, duration_ms, cost_usd, timestamp) VALUES ('$task_id', '$phase', '$model', $input_tokens, $cache_create, $cache_read, $output_tokens, $turns, $duration, $cost, '$timestamp');" 2>/dev/null || {
      token_errors=$((token_errors + 1))
      continue
    }

    token_count=$((token_count + 1))
  done < "$TOKEN_LOG"
fi

echo "  -> $token_count token usage records migrated ($token_errors errors)"

# ── 5. Migrate conversations ────────────────────────
echo ""
echo "[5/5] Migrating conversations..."

# Clear existing conversations for idempotency
sqlite3 "$DB_FILE" "DELETE FROM conversations;"

if [ -d "$OUTPUT_DIR" ]; then
  for conv_file in "$OUTPUT_DIR"/*-conversation.jsonl; do
    [ -f "$conv_file" ] || continue

    # Extract task_id and phase from filename: TASK-246-task-conversation.jsonl
    fname="$(basename "$conv_file" .jsonl)"
    task_id="$(echo "$fname" | sed 's/^\(TASK-[0-9]*\)-.*/\1/')"
    phase="$(echo "$fname" | sed 's/^TASK-[0-9]*-\(.*\)-conversation$/\1/')"

    line_num=0
    while IFS= read -r cline; do
      [ -z "$cline" ] && continue
      line_num=$((line_num + 1))

      # Extract type and subtype via simple sed (no jq dependency)
      c_type=""
      c_subtype=""
      c_tool=""

      # Match "type":"value" pattern
      type_match="$(echo "$cline" | sed -n 's/.*"type":"\([^"]*\)".*/\1/p')"
      [ -n "$type_match" ] && c_type="$type_match"

      subtype_match="$(echo "$cline" | sed -n 's/.*"subtype":"\([^"]*\)".*/\1/p')"
      [ -n "$subtype_match" ] && c_subtype="$subtype_match"

      # Extract tool_name if present
      tool_match="$(echo "$cline" | sed -n 's/.*"tool_name":"\([^"]*\)".*/\1/p')"
      [ -n "$tool_match" ] && c_tool="$tool_match"

      # Escape content for SQL
      cline_esc="$(echo "$cline" | sed "s/'/''/g")"

      sqlite3 "$DB_FILE" "INSERT INTO conversations (task_id, phase, line_number, type, subtype, tool_name, content) VALUES ('$task_id', '$phase', $line_num, '$c_type', '$c_subtype', '$c_tool', '$cline_esc');" 2>/dev/null || {
        conv_errors=$((conv_errors + 1))
        continue
      }

      conv_count=$((conv_count + 1))
    done < "$conv_file"
  done
fi

echo "  -> $conv_count conversation lines migrated ($conv_errors errors)"

# ── Summary ──────────────────────────────────────────
echo ""
echo "=== Migration Complete ==="
echo "  Tasks:          $task_count"
echo "  Notices:        $notice_count"
echo "  Token usage:    $token_count"
echo "  Conversations:  $conv_count"
echo "  Database:       $DB_FILE"
echo "  Size:           $(du -h "$DB_FILE" | cut -f1)"
