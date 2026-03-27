#!/bin/bash
set -euo pipefail

# Usage: ./scripts/job-review.sh TASK-XXX SIGNAL_DIR
#   단일 리뷰 1회 실행 후 signal 생성 + 종료
#   Exit: 0=승인(review-approved), 1=수정요청(review-rejected)

TASK_ID="${1:?Usage: ./scripts/job-review.sh TASK-XXX SIGNAL_DIR}"
SIGNAL_DIR="${2:?SIGNAL_DIR is required}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"

source "$REPO_ROOT/scripts/lib/signal.sh"
source "$REPO_ROOT/scripts/lib/context-builder.sh"
source "$REPO_ROOT/scripts/lib/model-selector.sh"

# ─── Signal 안전장치 ──────────────────────────────────────────
_signal_sent=false
trap '_ec=$?
  if [ "$_signal_sent" = false ] && [ "${SKIP_SIGNAL:-}" != "1" ]; then
    if [ "$_ec" -ne 0 ]; then
      signal_create "$SIGNAL_DIR" "$TASK_ID" "review-rejected"
    fi
  fi' EXIT

# ─── 디렉토리 설정 ────────────────────────────────────────────
if [ -d "$REPO_ROOT/.orchestration/tasks" ]; then
  TASK_DIR="$REPO_ROOT/.orchestration/tasks"
else
  TASK_DIR="$REPO_ROOT/docs/task"
fi
REQ_DIR="$REPO_ROOT/docs/requests"
if [ -d "$REPO_ROOT/.orchestration/output" ]; then
  OUTPUT_DIR="$REPO_ROOT/.orchestration/output"
else
  OUTPUT_DIR="$REPO_ROOT/output"
fi
TOKEN_LOG="$OUTPUT_DIR/token-usage.log"
mkdir -p "$OUTPUT_DIR"

# ─── 태스크 파일 찾기 ─────────────────────────────────────────

TASK_FILE=$(find "$TASK_DIR" -name "${TASK_ID}-*.md" 2>/dev/null | head -1)
if [ -z "$TASK_FILE" ]; then
  TASK_FILE=$(find "$REQ_DIR" -name "${TASK_ID}-*.md" 2>/dev/null | head -1)
fi
if [ -z "$TASK_FILE" ]; then
  echo "❌ Task 파일을 찾을 수 없습니다: ${TASK_ID}" >&2
  exit 1
fi
TASK_FILENAME=$(basename "$TASK_FILE")

# ─── frontmatter 파싱 ─────────────────────────────────────────

BRANCH=$(grep '^branch:' "$TASK_FILE" | head -1 | sed 's/branch: *//')
WORKTREE_REL=$(grep '^worktree:' "$TASK_FILE" | head -1 | sed 's/worktree: *//')
WORKTREE_PATH="$REPO_ROOT/$WORKTREE_REL"
REVIEWER_ROLE=$(grep '^reviewer_role:' "$TASK_FILE" | sed 's/reviewer_role: *//' || true)

if [ ! -d "$WORKTREE_PATH" ]; then
  echo "❌ Worktree가 존재하지 않습니다: $WORKTREE_PATH" >&2
  exit 1
fi

# ─── Role prompt ───────────────────────────────────────────────

ROLE_PROMPT=""
ROLE_DIR="$REPO_ROOT/docs/roles"
if [ -n "$REVIEWER_ROLE" ] && [ -f "$ROLE_DIR/${REVIEWER_ROLE}.md" ]; then
  ROLE_PROMPT=$(cat "$ROLE_DIR/${REVIEWER_ROLE}.md")
  echo "🎭 Review Role: $REVIEWER_ROLE"
else
  ROLE_PROMPT=$(cat "$ROLE_DIR/reviewer-general.md")
  echo "🎭 Review Role: reviewer-general (기본)"
fi

# ─── 리뷰 프롬프트 생성 ───────────────────────────────────────

setup_context_filter "$WORKTREE_PATH" "$REPO_ROOT"
prompt=$(build_review_prompt "$TASK_FILE" "$TASK_FILENAME")

# ─── 모델 선택 (리뷰는 haiku로 경량화) ──────────────────

selected_model="${REVIEW_MODEL:-claude-haiku-4-5}"
echo "🤖 리뷰 모델: ${selected_model} (경량)"

# ─── 실행 ──────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 [job-review] ${TASK_ID} 실행"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$WORKTREE_PATH"
model_args=()
[ -n "$selected_model" ] && model_args=(--model "$selected_model")

CONV_FILE="$OUTPUT_DIR/${TASK_ID}-review-conversation.jsonl"
if ! echo "$prompt" | claude --output-format json --dangerously-skip-permissions "${model_args[@]}" --system-prompt "$ROLE_PROMPT" > "$CONV_FILE"; then
  echo "❌ Claude 호출 실패" >&2
  exit 1
fi

JSON_OUTPUT=$(cat "$CONV_FILE")
result=$(echo "$JSON_OUTPUT" | jq -r '.result // empty')
echo "$result"

echo "$JSON_OUTPUT" | jq . > "$OUTPUT_DIR/${TASK_ID}-review.json"
echo "$result" > "$OUTPUT_DIR/${TASK_ID}-review-feedback.txt"

# 토큰 로그
input_tokens=$(echo "$JSON_OUTPUT" | jq '.usage.input_tokens // 0')
cache_create=$(echo "$JSON_OUTPUT" | jq '.usage.cache_creation_input_tokens // 0')
cache_read=$(echo "$JSON_OUTPUT" | jq '.usage.cache_read_input_tokens // 0')
output_tokens=$(echo "$JSON_OUTPUT" | jq '.usage.output_tokens // 0')
cost=$(echo "$JSON_OUTPUT" | jq '.total_cost_usd // 0')
duration=$(echo "$JSON_OUTPUT" | jq '.duration_ms // 0')
num_turns=$(echo "$JSON_OUTPUT" | jq '.num_turns // 0')
model=$(echo "$JSON_OUTPUT" | jq -r '(.modelUsage // {} | keys | first) // "unknown"')
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${TASK_ID} | phase=review | model=${model} | input=${input_tokens} cache_create=${cache_create} cache_read=${cache_read} output=${output_tokens} | turns=${num_turns} | duration=${duration}ms | cost=\$${cost}" >> "$TOKEN_LOG"
echo "📊 토큰: in=${input_tokens} out=${output_tokens} | model=${model} | cost=\$${cost}"

# ─── 승인/수정요청 판단 ────────────────────────────────────────

_signal_sent=true

# JSON verdict 파싱 시도, 실패 시 레거시 키워드 파싱
verdict=$(echo "$result" | jq -r '.verdict // empty' 2>/dev/null)

if [ "$verdict" = "승인" ]; then
  approved=true
elif [ -z "$verdict" ] && echo "$result" | grep -q "승인" && ! echo "$result" | grep -q "수정요청"; then
  # 레거시 키워드 파싱 fallback
  approved=true
else
  approved=false
fi

if [ "$approved" = true ]; then
  if [ "${SKIP_SIGNAL:-}" != "1" ]; then
    signal_create "$SIGNAL_DIR" "$TASK_ID" "review-approved"
  fi
  echo "✅ [job-review] ${TASK_ID} 승인 → review-approved signal"
  exit 0
fi

# 수정요청 또는 판단 불가 → rejected
if [ "${SKIP_SIGNAL:-}" != "1" ]; then
  signal_create "$SIGNAL_DIR" "$TASK_ID" "review-rejected"
fi
echo "🔄 [job-review] ${TASK_ID} 수정요청 → review-rejected signal"
exit 1
