#!/bin/bash
set -euo pipefail

# Usage: ./scripts/job-task.sh TASK-XXX SIGNAL_DIR [FEEDBACK_FILE]
#   단일 태스크 1회 실행 후 signal 생성 + 종료
#   Exit: 0=성공(task-done), 1=실패(task-failed)

TASK_ID="${1:?Usage: ./scripts/job-task.sh TASK-XXX SIGNAL_DIR [FEEDBACK_FILE]}"
SIGNAL_DIR="${2:?SIGNAL_DIR is required}"
FEEDBACK_FILE="${3:-}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"

source "$REPO_ROOT/scripts/lib/signal.sh"
source "$REPO_ROOT/scripts/lib/sed-inplace.sh"
source "$REPO_ROOT/scripts/lib/context-builder.sh"
source "$REPO_ROOT/scripts/lib/model-selector.sh"

# ─── 시작 시간 기록 + 타임아웃 (10분) ─────────────────────
JOB_TIMEOUT="${JOB_TIMEOUT:-600}"  # 기본 10분
date +%s > "${SIGNAL_DIR}/${TASK_ID}-start"

# 백그라운드 타임아웃 워치독
(
  sleep "$JOB_TIMEOUT"
  if kill -0 $$ 2>/dev/null; then
    echo "⏰ [job-task] ${TASK_ID}: ${JOB_TIMEOUT}초 타임아웃 → 강제 종료" >&2
    kill -TERM $$ 2>/dev/null
    sleep 5
    kill -9 $$ 2>/dev/null
  fi
) &
WATCHDOG_PID=$!

# ─── Signal 안전장치: 비정상 종료 시 failed signal ─────────────
_signal_sent=false
trap '_ec=$?
  kill "$WATCHDOG_PID" 2>/dev/null
  if [ "$_signal_sent" = false ] && [ "${SKIP_SIGNAL:-}" != "1" ]; then
    if [ -f "${SIGNAL_DIR}/${TASK_ID}-stop-request" ]; then
      rm -f "${SIGNAL_DIR}/${TASK_ID}-stop-request"
      signal_create "$SIGNAL_DIR" "$TASK_ID" "stopped"
    elif [ "$_ec" -ne 0 ]; then
      signal_create "$SIGNAL_DIR" "$TASK_ID" "task-failed"
    fi
  fi
  rm -f "${SIGNAL_DIR}/${TASK_ID}-start"' EXIT

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
mkdir -p "$OUTPUT_DIR" "$OUTPUT_DIR/logs"

# ─── 공통 함수 (run-worker.sh에서 추출) ───────────────────────

find_task_file() {
  TASK_FILE=$(find "$TASK_DIR" -name "${TASK_ID}-*.md" 2>/dev/null | head -1)
  if [ -z "$TASK_FILE" ]; then
    TASK_FILE=$(find "$REQ_DIR" -name "${TASK_ID}-*.md" 2>/dev/null | head -1)
  fi
  if [ -z "$TASK_FILE" ]; then
    echo "❌ Task 파일을 찾을 수 없습니다: ${TASK_ID}" >&2
    exit 1
  fi
  TASK_FILENAME=$(basename "$TASK_FILE")
  echo "📋 Task 파일: $TASK_FILENAME"
}

parse_frontmatter() {
  BRANCH=$(grep '^branch:' "$TASK_FILE" | head -1 | sed 's/branch: *//')
  WORKTREE_REL=$(grep '^worktree:' "$TASK_FILE" | head -1 | sed 's/worktree: *//')
  WORKTREE_PATH="$REPO_ROOT/$WORKTREE_REL"
  ROLE=$(grep '^role:' "$TASK_FILE" | sed 's/role: *//' || true)
  SCOPE=""
  local in_frontmatter=false in_scope=false
  while IFS= read -r line; do
    if [[ "$line" == "---" ]]; then
      if $in_frontmatter; then break; fi
      in_frontmatter=true; continue
    fi
    if ! $in_frontmatter; then continue; fi
    if [[ "$line" == "scope:" ]]; then in_scope=true; continue; fi
    if $in_scope; then
      if echo "$line" | grep -qE '^[[:space:]]*-[[:space:]]'; then
        SCOPE="${SCOPE}$(echo "$line" | sed 's/^[[:space:]]*-[[:space:]]*//')"$'\n'
      else
        break
      fi
    fi
  done < "$TASK_FILE"
  SCOPE=$(echo "$SCOPE" | sed '/^$/d')

  if [ -z "$BRANCH" ] || [ -z "$WORKTREE_REL" ]; then
    echo "❌ Task 파일에 branch 또는 worktree가 정의되지 않았습니다" >&2
    exit 1
  fi
  echo "🌿 Branch: $BRANCH"
  echo "📂 Worktree: $WORKTREE_PATH"
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
  local role_name="$1" default_name="$2"
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

log_tokens() {
  local phase="$1"
  local input_tokens cache_create cache_read output_tokens cost duration num_turns model
  # stream-json result 라인과 기존 json 모두 호환
  input_tokens=$(echo "$JSON_OUTPUT" | jq '.usage.input_tokens // 0' 2>/dev/null)
  cache_create=$(echo "$JSON_OUTPUT" | jq '.usage.cache_creation_input_tokens // .usage.cache_creation.ephemeral_1h_input_tokens // 0' 2>/dev/null)
  cache_read=$(echo "$JSON_OUTPUT" | jq '.usage.cache_read_input_tokens // 0' 2>/dev/null)
  output_tokens=$(echo "$JSON_OUTPUT" | jq '.usage.output_tokens // 0' 2>/dev/null)
  cost=$(echo "$JSON_OUTPUT" | jq '.total_cost_usd // 0' 2>/dev/null)
  duration=$(echo "$JSON_OUTPUT" | jq '.duration_ms // 0' 2>/dev/null)
  num_turns=$(echo "$JSON_OUTPUT" | jq '.num_turns // 0' 2>/dev/null)
  model=$(echo "$JSON_OUTPUT" | jq -r '(.modelUsage // {} | keys | first) // "unknown"' 2>/dev/null)
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${TASK_ID} | phase=${phase} | model=${model} | input=${input_tokens} cache_create=${cache_create} cache_read=${cache_read} output=${output_tokens} | turns=${num_turns} | duration=${duration}ms | cost=\$${cost}" >> "$TOKEN_LOG"
  echo "📊 토큰: in=${input_tokens} cache_create=${cache_create} cache_read=${cache_read} out=${output_tokens} | model=${model} | cost=\$${cost}"
}

# ─── 실행 ──────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 [job-task] ${TASK_ID} 실행"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

find_task_file
parse_frontmatter
ensure_worktree
load_role_prompt "$ROLE" "general"

# 컨텍스트 필터
setup_context_filter "$WORKTREE_PATH" "$REPO_ROOT"

# 프롬프트 생성
prompt=$(build_task_prompt "$TASK_FILE" "$TASK_FILENAME" "$SCOPE" "$FEEDBACK_FILE")
if [ -n "$FEEDBACK_FILE" ] && [ -f "$FEEDBACK_FILE" ]; then
  echo "📝 이전 리뷰 피드백 포함"
fi

# 모델 선택
selected_model=$(select_model "$TASK_FILE")
log_model_selection "$TASK_FILE" "$TASK_ID" "$TOKEN_LOG"

# Claude 1회 호출
cd "$WORKTREE_PATH"
model_args=()
[ -n "$selected_model" ] && model_args=(--model "$selected_model")

CONV_FILE="$OUTPUT_DIR/${TASK_ID}-task-conversation.jsonl"

# stream-json: claude → CONV_FILE에 전체 저장 + stdout에 도구 호출 로그 출력
echo "$prompt" | claude --output-format stream-json --verbose --dangerously-skip-permissions "${model_args[@]}" --system-prompt "$ROLE_PROMPT" \
  | tee "$CONV_FILE" | while IFS= read -r line; do
      type=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)
      case "$type" in
        assistant)
          # 도구 호출 로그 (Read, Edit, Bash, Write, Grep, Glob 등)
          echo "$line" | jq -r '.message.content[]? | select(.type=="tool_use") | "🔧 \(.name): \(.input.command // .input.file_path // .input.pattern // .input.content[0:80] // "" | tostring | split("\n")[0])"' 2>/dev/null | while IFS= read -r tool_line; do
            [ -n "$tool_line" ] && echo "$tool_line"
          done
          ;;
        result)
          echo "━━━ Claude 작업 완료 ━━━"
          ;;
      esac
    done

# 파이프 exit code: PIPESTATUS[0]이 claude의 exit code
CLAUDE_EXIT=${PIPESTATUS[0]:-0}
if [ "$CLAUDE_EXIT" -ne 0 ]; then
  echo "❌ Claude 호출 실패 (exit=$CLAUDE_EXIT)" >&2
  exit 1
fi

# stream-json에서 최종 result 추출
JSON_OUTPUT=$(grep '"type":"result"' "$CONV_FILE" | tail -1)
if [ -z "$JSON_OUTPUT" ]; then
  echo "❌ result를 찾을 수 없습니다" >&2
  exit 1
fi
RESULT_RAW=$(echo "$JSON_OUTPUT" | jq -r '.result // empty' 2>/dev/null)
echo "$JSON_OUTPUT" | jq . > "$OUTPUT_DIR/${TASK_ID}-task.json" 2>/dev/null
log_tokens "task"

# result에서 JSON 추출 (텍스트가 섞여있을 수 있음)
RESULT_JSON=$(echo "$RESULT_RAW" | grep -o '{[^}]*}' | tail -1)
if [ -z "$RESULT_JSON" ]; then
  RESULT_JSON="$RESULT_RAW"
fi

# 거절 감지: JSON status=rejected 또는 레거시 "거절:" 키워드
TASK_STATUS=$(echo "$RESULT_JSON" | jq -r '.status // empty' 2>/dev/null)
if [ "$TASK_STATUS" = "rejected" ] || echo "$RESULT_RAW" | head -1 | grep -q "^거절:"; then
  _signal_sent=true
  # JSON이면 reason 추출, 아니면 전체 텍스트
  local reject_reason
  reject_reason=$(echo "$RESULT_JSON" | jq -r '.reason // empty' 2>/dev/null)
  [ -z "$reject_reason" ] && reject_reason="$RESULT_RAW"
  echo "$reject_reason" > "$OUTPUT_DIR/${TASK_ID}-rejection-reason.txt"
  if [ "${SKIP_SIGNAL:-}" != "1" ]; then
    signal_create "$SIGNAL_DIR" "$TASK_ID" "task-rejected"
  fi
  # task 파일 status를 rejected로 직접 변경 (개별 실행 시 orchestrate.sh가 없으므로)
  task_file=$(find "$REPO_ROOT/.orchestration/tasks" -name "${TASK_ID}-*" -type f 2>/dev/null | head -1)
  if [ -n "$task_file" ]; then
    sed_inplace "s/^status: .*/status: rejected/" "$task_file"
    git -C "$REPO_ROOT" add "$task_file" 2>/dev/null || true
    git -C "$REPO_ROOT" commit --only "$task_file" \
      -m "chore(${TASK_ID}): status → rejected" 2>/dev/null || true
  fi
  echo "🚫 [job-task] ${TASK_ID} 거절됨 → task-rejected signal"
  exit 0
fi

# 성공 signal
_signal_sent=true
if [ "${SKIP_SIGNAL:-}" != "1" ]; then
  signal_create "$SIGNAL_DIR" "$TASK_ID" "task-done"
fi
echo "✅ [job-task] ${TASK_ID} 완료 → task-done signal"
exit 0
