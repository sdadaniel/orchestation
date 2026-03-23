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

  # 2. AI가 request를 분석하여 실행 가능한지 판단
  log "Evaluating $REQ_ID..."

  EVAL_PROMPT="너는 소프트웨어 개발 태스크 매니저다.

아래 개선 요청을 분석하고, 실행 가능한지 판단해라.

요청 ID: $REQ_ID
제목: $REQ_TITLE
우선순위: $REQ_PRIORITY
내용: $REQ_BODY

판단 기준:
- 요청이 구체적인가? (어떤 파일, 어떤 기능, 어떤 변경인지 파악 가능한가?)
- 범위가 명확한가? (하나의 태스크로 완료할 수 있는 크기인가?)
- 모호하거나 추상적인가? (\"좋게 해줘\", \"개선해줘\" 같은 표현만 있는가?)

반드시 다음 형식으로만 답변해라:
DECISION: accept 또는 reject
REASON: 한줄 사유
TASK_TITLE: (accept일 경우) 태스크 제목
TASK_DESCRIPTION: (accept일 경우) 구체적인 완료 조건 목록"

  EVAL_RESULT=""
  if command -v claude &>/dev/null; then
    EVAL_RESULT=$(echo "$EVAL_PROMPT" | claude --print --model claude-sonnet-4-6 2>/dev/null || echo "DECISION: reject
REASON: Claude 호출 실패")
  else
    EVAL_RESULT="DECISION: reject
REASON: claude CLI not found"
  fi

  DECISION=$(echo "$EVAL_RESULT" | grep "^DECISION:" | head -1 | sed 's/DECISION: *//')

  # 3. 거절이면 rejected 상태로 변경하고 사유 기록
  if [[ "$DECISION" != "accept" ]]; then
    REJECT_REASON=$(echo "$EVAL_RESULT" | grep "^REASON:" | head -1 | sed 's/REASON: *//')
    update_status "$PENDING_FILE" "rejected"

    # 거절 사유를 파일에 추가
    echo "" >> "$PENDING_FILE"
    echo "---" >> "$PENDING_FILE"
    echo "**거절 사유:** $REJECT_REASON" >> "$PENDING_FILE"
    echo "**거절 시각:** $(date '+%Y-%m-%d %H:%M:%S')" >> "$PENDING_FILE"

    log "Rejected $REQ_ID: $REJECT_REASON"
    sleep 2
    continue
  fi

  log "Accepted $REQ_ID. Generating task..."

  # 4. Accept — Task 생성
  TASK_TITLE=$(echo "$EVAL_RESULT" | grep "^TASK_TITLE:" | head -1 | sed 's/TASK_TITLE: *//')
  TASK_DESC=$(echo "$EVAL_RESULT" | sed -n '/^TASK_DESCRIPTION:/,$ p' | tail -n +2)

  # 다음 TASK ID 계산
  NEXT_TASK_NUM=$(find "$PROJECT_ROOT/docs/task" -name "TASK-*.md" | sed 's/.*TASK-0*//' | sed 's/-.*//' | sort -n | tail -1)
  NEXT_TASK_NUM=$(printf "%03d" $((10#$NEXT_TASK_NUM + 1)))
  TASK_ID="TASK-${NEXT_TASK_NUM}"
  TASK_SLUG=$(echo "$TASK_TITLE" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9가-힣-]//g' | head -c 40)
  TASK_FILE="$PROJECT_ROOT/docs/task/${TASK_ID}-${TASK_SLUG}.md"

  cat > "$TASK_FILE" << TASKEOF
---
id: ${TASK_ID}
title: ${TASK_TITLE}
status: backlog
priority: ${REQ_PRIORITY}
sprint:
depends_on: []
branch: task/${TASK_ID}-${TASK_SLUG}
worktree: ../repo-wt-${TASK_ID}
role: general
reviewer_role: reviewer-general
---

# ${TASK_ID}: ${TASK_TITLE}

## 원본 요청

- Request: ${REQ_ID}
- 제목: ${REQ_TITLE}
- 내용: ${REQ_BODY}

## 완료 조건

${TASK_DESC}
TASKEOF

  log "Created $TASK_ID: $TASK_TITLE"

  # 5. Git에 커밋
  cd "$PROJECT_ROOT"
  git add "$TASK_FILE" 2>/dev/null || true
  git commit -m "feat(${TASK_ID}): auto-generated from ${REQ_ID}" 2>/dev/null || true

  # 6. Orchestrate 실행
  if [[ -x "$ORCHESTRATE" ]]; then
    log "Running orchestration for $TASK_ID..."
    bash "$ORCHESTRATE" 2>&1 | while IFS= read -r line; do
      log "[orchestrate] $line"
    done || {
      log "Warning: Orchestration had errors for $TASK_ID"
    }
  fi

  # 7. Request를 done으로
  update_status "$PENDING_FILE" "done"
  log "Completed $REQ_ID → $TASK_ID"

  sleep 2
done
