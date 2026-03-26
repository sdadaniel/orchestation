#!/bin/bash
set -euo pipefail

# Usage: ./scripts/run-worker.sh TASK-XXX [SIGNAL_DIR] [MAX_RETRY]
#   SIGNAL_DIR  생략 시 signal 파일 미생성
#   MAX_RETRY   생략 시 기본값 2
# Exit: 0=승인, 1=실패

TASK_ID="${1:?Usage: ./scripts/run-worker.sh TASK-XXX [SIGNAL_DIR] [MAX_RETRY]}"
SIGNAL_DIR="${2:-}"
MAX_RETRY="${3:-${MAX_REVIEW_RETRY:-2}}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"

# ─── 입력 검증 ────────────────────────────────────────────
if ! [[ "$MAX_RETRY" =~ ^[0-9]+$ ]]; then
  echo "❌ MAX_RETRY는 0 이상의 정수여야 합니다: $MAX_RETRY" >&2
  exit 1
fi

# Load signal helper for atomic signal file operations
source "$REPO_ROOT/scripts/lib/signal.sh"
# Load context builder for minimal context loading
source "$REPO_ROOT/scripts/lib/context-builder.sh"
# Load model selector for complexity-based model selection
source "$REPO_ROOT/scripts/lib/model-selector.sh"

# EXIT trap: 비정상 종료 시에도 signal 파일 생성
# _worker_signal_sent=true이면 이미 signal을 보냈으므로 중복 생성 방지
_worker_exit_code=0
_worker_signal_sent=false
trap '_worker_exit_code=$?
  if [ "$_worker_signal_sent" = false ] && [ -n "$SIGNAL_DIR" ]; then
    # stop-request 파일이 있으면 사용자 요청에 의한 중지 → stopped 시그널
    if [ -f "${SIGNAL_DIR}/${TASK_ID}-stop-request" ]; then
      rm -f "${SIGNAL_DIR}/${TASK_ID}-stop-request"
      signal_create "$SIGNAL_DIR" "$TASK_ID" "stopped"
    elif [ "$_worker_exit_code" -ne 0 ]; then
      signal_create "$SIGNAL_DIR" "$TASK_ID" "failed"
    fi
  fi' EXIT

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

# ─── 공통 함수 ───────────────────────────────────────────

find_task_file() {
  # docs/task/ 또는 docs/requests/ 에서 검색
  TASK_FILE=$(find "$TASK_DIR" -name "${TASK_ID}-*.md" 2>/dev/null | head -1)
  if [ -z "$TASK_FILE" ]; then
    TASK_FILE=$(find "$REQ_DIR" -name "${TASK_ID}-*.md" 2>/dev/null | head -1)
  fi
  if [ -z "$TASK_FILE" ]; then
    echo "❌ Task 파일을 찾을 수 없습니다: ${TASK_ID}"
    exit 1
  fi
  TASK_FILENAME=$(basename "$TASK_FILE")
  echo "📋 Task 파일: $TASK_FILENAME"
}

parse_frontmatter() {
  BRANCH=$(grep '^branch:' "$TASK_FILE" | sed 's/branch: *//')
  WORKTREE_REL=$(grep '^worktree:' "$TASK_FILE" | sed 's/worktree: *//')
  WORKTREE_PATH="$REPO_ROOT/$WORKTREE_REL"
  ROLE=$(grep '^role:' "$TASK_FILE" | sed 's/role: *//' || true)
  REVIEWER_ROLE=$(grep '^reviewer_role:' "$TASK_FILE" | sed 's/reviewer_role: *//' || true)

  # scope 필드 파싱 (frontmatter 내 YAML 리스트: "  - path" 형태)
  SCOPE=""
  local in_frontmatter=false in_scope=false
  while IFS= read -r line; do
    if [[ "$line" == "---" ]]; then
      if $in_frontmatter; then break; fi
      in_frontmatter=true
      continue
    fi
    if ! $in_frontmatter; then continue; fi
    if [[ "$line" == "scope:" ]]; then
      in_scope=true
      continue
    fi
    if $in_scope; then
      if echo "$line" | grep -qE '^[[:space:]]*-[[:space:]]'; then
        local item
        item=$(echo "$line" | sed 's/^[[:space:]]*-[[:space:]]*//')
        SCOPE="${SCOPE}${item}"$'\n'
      else
        break
      fi
    fi
  done < "$TASK_FILE"
  SCOPE=$(echo "$SCOPE" | sed '/^$/d')

  if [ -z "$BRANCH" ] || [ -z "$WORKTREE_REL" ]; then
    echo "❌ Task 파일에 branch 또는 worktree가 정의되지 않았습니다"
    exit 1
  fi

  echo "🌿 Branch: $BRANCH"
  echo "📂 Worktree: $WORKTREE_PATH"
  if [ -n "$SCOPE" ]; then
    echo "🔍 Scope: $(echo "$SCOPE" | wc -l | tr -d ' ')개 파일 제한"
  fi
}

ensure_worktree() {
  if [ ! -d "$WORKTREE_PATH" ]; then
    echo "🔨 Worktree 생성 중..."
    git -C "$REPO_ROOT" worktree add "$WORKTREE_PATH" -b "$BRANCH" 2>/dev/null || \
    git -C "$REPO_ROOT" worktree add "$WORKTREE_PATH" "$BRANCH"
    echo "✅ Worktree 생성 완료"
  else
    echo "✅ Worktree 이미 존재"
  fi
}

load_role_prompt() {
  local role_name="$1"
  local default_name="$2"
  local role_dir="$REPO_ROOT/docs/roles"

  ROLE_PROMPT=""
  if [ -n "$role_name" ] && [ -f "$role_dir/${role_name}.md" ]; then
    ROLE_PROMPT=$(cat "$role_dir/${role_name}.md")
    echo "🎭 Role: $role_name"
  elif [ -n "$role_name" ] && [ ! -f "$role_dir/${role_name}.md" ]; then
    echo "⚠️  Role '${role_name}' 파일 없음 → ${default_name} 사용"
    ROLE_PROMPT=$(cat "$role_dir/${default_name}.md")
  else
    ROLE_PROMPT=$(cat "$role_dir/${default_name}.md")
    echo "🎭 Role: ${default_name} (기본)"
  fi
}

invoke_claude() {
  local prompt="$1"
  local conversation_file="$2"
  local model="${3:-}"

  cd "$WORKTREE_PATH"
  local model_args=()
  if [ -n "$model" ]; then
    model_args=(--model "$model")
  fi
  if ! echo "$prompt" | claude --output-format json --dangerously-skip-permissions "${model_args[@]}" --system-prompt "$ROLE_PROMPT" > "$conversation_file"; then
    echo "❌ Claude 호출 실패" >&2
    return 1
  fi
  JSON_OUTPUT=$(cat "$conversation_file")
}

save_output() {
  local suffix="$1"
  echo "$JSON_OUTPUT" | jq -r '.result // empty'
  echo "$JSON_OUTPUT" | jq . > "$OUTPUT_DIR/${TASK_ID}-${suffix}.json"
}

log_tokens() {
  local phase="$1"

  local input_tokens cache_create cache_read output_tokens cost duration num_turns model
  input_tokens=$(echo "$JSON_OUTPUT" | jq '.usage.input_tokens // 0')
  cache_create=$(echo "$JSON_OUTPUT" | jq '.usage.cache_creation_input_tokens // 0')
  cache_read=$(echo "$JSON_OUTPUT" | jq '.usage.cache_read_input_tokens // 0')
  output_tokens=$(echo "$JSON_OUTPUT" | jq '.usage.output_tokens // 0')
  cost=$(echo "$JSON_OUTPUT" | jq '.total_cost_usd // 0')
  duration=$(echo "$JSON_OUTPUT" | jq '.duration_ms // 0')
  num_turns=$(echo "$JSON_OUTPUT" | jq '.num_turns // 0')
  model=$(echo "$JSON_OUTPUT" | jq -r '(.modelUsage // {} | keys | first) // "unknown"')

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${TASK_ID} | phase=${phase} | model=${model} | input=${input_tokens} cache_create=${cache_create} cache_read=${cache_read} output=${output_tokens} | turns=${num_turns} | duration=${duration}ms | cost=\$${cost}" >> "$TOKEN_LOG"

  echo ""
  echo "📊 토큰: in=${input_tokens} cache_create=${cache_create} cache_read=${cache_read} out=${output_tokens} | model=${model} | cost=\$${cost}"
}

# ─── Task 실행 ────────────────────────────────────────────

run_task() {
  local feedback_file="${1:-}"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🚀 작업자 Agent 실행 중..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  find_task_file
  parse_frontmatter
  ensure_worktree
  load_role_prompt "$ROLE" "general"

  # 컨텍스트 필터링: 완료된 태스크를 .claudeignore로 제외
  setup_context_filter "$WORKTREE_PATH" "$REPO_ROOT"
  echo "🔒 컨텍스트 필터 설정 완료 (완료된 태스크 제외)"

  # 태스크 내용을 프롬프트에 직접 임베드 (파일 읽기 최소화)
  local prompt
  prompt=$(build_task_prompt "$TASK_FILE" "$TASK_FILENAME" "$SCOPE" "$feedback_file")

  if [ -n "$feedback_file" ] && [ -f "$feedback_file" ]; then
    echo "📝 이전 리뷰 피드백 포함"
  fi

  # 복잡도 기반 모델 선택
  local selected_model
  selected_model=$(select_model "$TASK_FILE")
  log_model_selection "$TASK_FILE" "$TASK_ID" "$TOKEN_LOG"

  invoke_claude "$prompt" "$OUTPUT_DIR/${TASK_ID}-task-conversation.jsonl" "$selected_model"
  save_output "task"
  log_tokens "task"
}

# ─── Review 실행 ──────────────────────────────────────────

run_review() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔍 Reviewer Agent 실행 중..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  find_task_file
  parse_frontmatter
  load_role_prompt "$REVIEWER_ROLE" "reviewer-general"

  if [ ! -d "$WORKTREE_PATH" ]; then
    echo "❌ Worktree가 존재하지 않습니다: $WORKTREE_PATH"
    return 1
  fi

  # 컨텍스트 필터링 (리뷰에도 동일 적용)
  setup_context_filter "$WORKTREE_PATH" "$REPO_ROOT"

  # 태스크 내용을 프롬프트에 직접 임베드
  local prompt
  prompt=$(build_review_prompt "$TASK_FILE" "$TASK_FILENAME")

  # 리뷰도 동일 모델 사용
  local selected_model
  selected_model=$(select_model "$TASK_FILE")
  log_model_selection "$TASK_FILE" "$TASK_ID" "$TOKEN_LOG"

  invoke_claude "$prompt" "$OUTPUT_DIR/${TASK_ID}-review-conversation.jsonl" "$selected_model"
  local result
  result=$(echo "$JSON_OUTPUT" | jq -r '.result // empty')
  echo "$result"

  echo "$JSON_OUTPUT" | jq . > "$OUTPUT_DIR/${TASK_ID}-review.json"
  echo "$result" > "$OUTPUT_DIR/${TASK_ID}-review-feedback.txt"

  log_tokens "review"

  # 승인 여부 판단
  if echo "$result" | grep -q "수정요청"; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔄 수정 요청됨"
    return 1
  elif echo "$result" | grep -q "승인"; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ 리뷰 승인됨"
    return 0
  else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔄 수정 요청됨"
    return 1
  fi
}

# ─── 메인: Task → Review → Retry 루프 ────────────────────

FEEDBACK_FILE="$OUTPUT_DIR/${TASK_ID}-review-feedback.txt"
RETRY_LOG="$OUTPUT_DIR/logs/${TASK_ID}-retry.log"
mkdir -p "$OUTPUT_DIR/logs"

log_retry() {
  local msg="$1"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${TASK_ID} | $msg" | tee -a "$RETRY_LOG"
}

log_retry "MAX_RETRY=${MAX_RETRY} 로 작업 시작"

for i in $(seq 0 "$MAX_RETRY"); do
  local_attempt=$((i + 1))
  local_total=$((MAX_RETRY + 1))
  log_retry "attempt=${local_attempt}/${local_total} 시작"

  # 작업 실행 (재시도 시 리뷰 피드백 전달)
  FEEDBACK_ARG=""
  if [ "$i" -gt 0 ] && [ -f "$FEEDBACK_FILE" ]; then
    FEEDBACK_ARG="$FEEDBACK_FILE"
  fi

  if run_task "$FEEDBACK_ARG"; then
    # 리뷰 실행
    if run_review; then
      rm -f "$FEEDBACK_FILE"
      log_retry "attempt=${local_attempt}/${local_total} 리뷰 승인됨 ✅"
      if [ -n "$SIGNAL_DIR" ]; then
        _worker_signal_sent=true
        signal_create "$SIGNAL_DIR" "$TASK_ID" "done"
      fi
      exit 0
    else
      log_retry "attempt=${local_attempt}/${local_total} 리뷰 실패 (수정 요청)"
    fi
  else
    log_retry "attempt=${local_attempt}/${local_total} 작업 실행 실패"
  fi

  # 마지막 시도였으면 실패
  if [ "$i" -eq "$MAX_RETRY" ]; then
    log_retry "retry 상한(${MAX_RETRY}) 초과 → failed 처리"
    if [ -n "$SIGNAL_DIR" ]; then
      _worker_signal_sent=true
      signal_create "$SIGNAL_DIR" "$TASK_ID" "failed"
    fi
    exit 1
  fi

  log_retry "리뷰 실패, 피드백 반영하여 재작업 시도... ($((i + 1))/${MAX_RETRY})"
  echo ""
done
