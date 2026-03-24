#!/bin/bash
set -euo pipefail

# Usage: ./scripts/run-worker.sh TASK-XXX [SIGNAL_DIR] [MAX_RETRY]
#   SIGNAL_DIR  생략 시 signal 파일 미생성
#   MAX_RETRY   생략 시 기본값 2
# Exit: 0=승인, 1=실패

TASK_ID="${1:?Usage: ./scripts/run-worker.sh TASK-XXX [SIGNAL_DIR] [MAX_RETRY]}"
SIGNAL_DIR="${2:-}"
MAX_RETRY="${3:-2}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"

TASK_DIR="$REPO_ROOT/docs/task"
REQ_DIR="$REPO_ROOT/docs/requests"
OUTPUT_DIR="$REPO_ROOT/output"
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

  if [ -z "$BRANCH" ] || [ -z "$WORKTREE_REL" ]; then
    echo "❌ Task 파일에 branch 또는 worktree가 정의되지 않았습니다"
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

  cd "$WORKTREE_PATH"
  echo "$prompt" | claude --output-format json --dangerously-skip-permissions --system-prompt "$ROLE_PROMPT" > "$conversation_file"
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

  local prompt="## 작업 규칙
- 이 Worktree 안에서만 코드를 수정한다
- main 브랜치를 직접 수정하지 않는다
- Task 상태를 완료 처리하지 않는다
- 작업이 끝나면 변경사항을 커밋해라

지금 수행할 Task는 docs/task/${TASK_FILENAME} 에 정의되어 있다.
해당 파일을 읽고, 완료 조건을 모두 충족하도록 작업해라."

  if [ -n "$feedback_file" ] && [ -f "$feedback_file" ]; then
    local feedback
    feedback=$(cat "$feedback_file")
    prompt="${prompt}

## 이전 리뷰 피드백 (수정 요청)
아래는 이전 리뷰에서 받은 수정 요청이다. 반드시 이 피드백을 반영하여 작업해라:

${feedback}"
    echo "📝 이전 리뷰 피드백 포함"
  fi

  invoke_claude "$prompt" "$OUTPUT_DIR/${TASK_ID}-task-conversation.jsonl"
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

  local prompt="## 리뷰 규칙
- 코드를 직접 수정하지 않는다
- Task 파일의 완료 조건을 기준으로 검증한다
- git diff main에 나온 파일만 검증하라. 관련 없는 코드를 읽지 마라
- 불필요한 파일 탐색을 하지 마라. 간결하게 리뷰하고 결론을 빠르게 내라

지금 리뷰할 Task는 docs/task/${TASK_FILENAME} 에 정의되어 있다.

다음 순서로 리뷰를 수행해라:

1. docs/task/${TASK_FILENAME} 을 읽고 완료 조건을 확인해라
2. 이 브랜치에서 변경된 코드를 git diff main 으로 확인해라
3. 완료 조건을 하나씩 검증해라
4. 테스트가 있으면 실행해서 통과 여부를 확인해라

리뷰 결과를 다음 형식으로 출력해라:

## 리뷰 결과: [승인 / 수정요청]

### 완료 조건 체크
- [ ] 또는 [x] 각 완료 조건 항목

### 발견된 문제 (있을 경우)
- 문제 설명

### 총평
- 한줄 요약"

  invoke_claude "$prompt" "$OUTPUT_DIR/${TASK_ID}-review-conversation.jsonl"
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

for i in $(seq 0 "$MAX_RETRY"); do
  # 작업 실행 (재시도 시 리뷰 피드백 전달)
  FEEDBACK_ARG=""
  if [ "$i" -gt 0 ] && [ -f "$FEEDBACK_FILE" ]; then
    FEEDBACK_ARG="$FEEDBACK_FILE"
  fi

  if run_task "$FEEDBACK_ARG"; then
    # 리뷰 실행
    if run_review; then
      rm -f "$FEEDBACK_FILE"
      if [ -n "$SIGNAL_DIR" ]; then
        touch "${SIGNAL_DIR}/${TASK_ID}-done"
      fi
      exit 0
    fi
  fi

  # 마지막 시도였으면 실패
  if [ "$i" -eq "$MAX_RETRY" ]; then
    if [ -n "$SIGNAL_DIR" ]; then
      touch "${SIGNAL_DIR}/${TASK_ID}-failed"
    fi
    exit 1
  fi

  echo ""
  echo "[retry] 리뷰 실패, 피드백 반영하여 재작업 시도... ($((i + 1))/${MAX_RETRY})"
  echo ""
done
