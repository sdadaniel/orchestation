#!/bin/bash
# auto-improve.sh
# Picks up pending requests, generates tasks, runs orchestration
# Usage: bash scripts/auto-improve.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REQUESTS_DIR="$PROJECT_ROOT/docs/requests"
ORCHESTRATE="$PROJECT_ROOT/scripts/orchestrate.sh"

SLEEP_INTERVAL=${SLEEP_INTERVAL:-30}

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Update request status in markdown frontmatter
update_status() {
  local file="$1"
  local new_status="$2"

  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/^status: .*/status: ${new_status}/" "$file"
  else
    sed -i "s/^status: .*/status: ${new_status}/" "$file"
  fi
  log "Updated $(basename "$file") -> status: $new_status"
}

# Extract frontmatter field value
get_field() {
  local file="$1"
  local field="$2"
  grep "^${field}:" "$file" | head -1 | sed "s/^${field}: *//"
}

# Get body content (after frontmatter)
get_body() {
  local file="$1"
  awk 'BEGIN{c=0} /^---$/{c++; next} c>=2{print}' "$file"
}

log "Auto-improve daemon started"
log "Watching: $REQUESTS_DIR"
log "Sleep interval: ${SLEEP_INTERVAL}s"

while true; do
  # Find oldest pending request (sorted by filename = REQ-XXX order)
  PENDING_FILE=""
  if [[ -d "$REQUESTS_DIR" ]]; then
    PENDING_FILE=$(find "$REQUESTS_DIR" -name "REQ-*.md" -exec grep -l "^status: pending" {} \; 2>/dev/null | sort | head -1 || true)
  fi

  if [[ -z "$PENDING_FILE" ]]; then
    log "No pending requests. Sleeping..."
    sleep "$SLEEP_INTERVAL"
    continue
  fi

  REQ_ID=$(get_field "$PENDING_FILE" "id")
  REQ_TITLE=$(get_field "$PENDING_FILE" "title")
  REQ_PRIORITY=$(get_field "$PENDING_FILE" "priority")
  REQ_BODY=$(get_body "$PENDING_FILE")

  log "Processing $REQ_ID: $REQ_TITLE (priority: $REQ_PRIORITY)"

  # 1. Change status to in_progress
  update_status "$PENDING_FILE" "in_progress"

  # 2. Use Claude to analyze request and generate a task
  log "Generating task for $REQ_ID..."

  TASK_PROMPT="Based on this improvement request, create a task markdown file.

Request ID: $REQ_ID
Title: $REQ_TITLE
Priority: $REQ_PRIORITY
Description: $REQ_BODY

Generate a task file with appropriate title, priority, and detailed implementation steps."

  if command -v claude &>/dev/null; then
    claude -p "$TASK_PROMPT" --output-file /tmp/auto-improve-task.md 2>/dev/null || {
      log "Warning: Claude task generation failed for $REQ_ID"
    }
  else
    log "Warning: claude CLI not found. Skipping task generation."
  fi

  # 3. Run orchestrate.sh if it exists
  if [[ -x "$ORCHESTRATE" ]]; then
    log "Running orchestration..."
    bash "$ORCHESTRATE" 2>&1 | while IFS= read -r line; do
      log "[orchestrate] $line"
    done || {
      log "Warning: Orchestration had errors for $REQ_ID"
    }
  else
    log "Warning: orchestrate.sh not found at $ORCHESTRATE"
  fi

  # 4. Change request status to done
  update_status "$PENDING_FILE" "done"
  log "Completed $REQ_ID"

  sleep 2
done
