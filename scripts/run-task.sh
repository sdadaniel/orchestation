#!/bin/bash
set -euo pipefail

# Usage: ./scripts/run-task.sh TASK-001 [REVIEW_FEEDBACK_FILE]

TASK_ID="${1:?Usage: ./scripts/run-task.sh TASK-XXX}"
REVIEW_FEEDBACK_FILE="${2:-}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# claude CLI가 PATH에 없을 수 있으므로 추가
export PATH="$HOME/.local/bin:$PATH"
TASK_DIR="$REPO_ROOT/docs/task"

# TASK 파일 찾기
TASK_FILE=$(find "$TASK_DIR" -name "${TASK_ID}-*.md" | head -1)
if [ -z "$TASK_FILE" ]; then
  echo "❌ Task 파일을 찾을 수 없습니다: ${TASK_ID}"
  exit 1
fi

TASK_FILENAME=$(basename "$TASK_FILE")
echo "📋 Task 파일: $TASK_FILENAME"

# frontmatter에서 branch, worktree 파싱
BRANCH=$(grep '^branch:' "$TASK_FILE" | sed 's/branch: *//')
WORKTREE_REL=$(grep '^worktree:' "$TASK_FILE" | sed 's/worktree: *//')

if [ -z "$BRANCH" ] || [ -z "$WORKTREE_REL" ]; then
  echo "❌ Task 파일에 branch 또는 worktree가 정의되지 않았습니다"
  exit 1
fi

# worktree 절대경로 (REPO_ROOT 기준 상대경로 해석)
WORKTREE_PATH="$(cd "$REPO_ROOT" && cd "$(dirname "$WORKTREE_REL")" 2>/dev/null && pwd)/$(basename "$WORKTREE_REL")" 2>/dev/null || true
WORKTREE_PATH="$REPO_ROOT/$WORKTREE_REL"

echo "🌿 Branch: $BRANCH"
echo "📂 Worktree: $WORKTREE_PATH"

# worktree 생성 (없으면)
if [ ! -d "$WORKTREE_PATH" ]; then
  echo "🔨 Worktree 생성 중..."
  git -C "$REPO_ROOT" worktree add "$WORKTREE_PATH" -b "$BRANCH" 2>/dev/null || \
  git -C "$REPO_ROOT" worktree add "$WORKTREE_PATH" "$BRANCH"
  echo "✅ Worktree 생성 완료"
else
  echo "✅ Worktree 이미 존재"
fi

# role 프롬프트 로드
ROLE=$(grep '^role:' "$TASK_FILE" | sed 's/role: *//')
ROLE_DIR="$REPO_ROOT/docs/roles"
ROLE_PROMPT=""

if [ -n "$ROLE" ] && [ -f "$ROLE_DIR/${ROLE}.md" ]; then
  ROLE_PROMPT=$(cat "$ROLE_DIR/${ROLE}.md")
  echo "🎭 Role: $ROLE"
elif [ -n "$ROLE" ] && [ ! -f "$ROLE_DIR/${ROLE}.md" ]; then
  echo "⚠️  Role '${ROLE}' 파일 없음 → general 사용"
  ROLE_PROMPT=$(cat "$ROLE_DIR/general.md")
else
  ROLE_PROMPT=$(cat "$ROLE_DIR/general.md")
  echo "🎭 Role: general (기본)"
fi

# 작업자 프롬프트 구성
PROMPT="${ROLE_PROMPT}

## 작업 규칙
- 이 Worktree 안에서만 코드를 수정한다
- main 브랜치를 직접 수정하지 않는다
- Task 상태를 완료 처리하지 않는다
- 작업이 끝나면 변경사항을 커밋해라

지금 수행할 Task는 docs/task/${TASK_FILENAME} 에 정의되어 있다.
해당 파일을 읽고, 완료 조건을 모두 충족하도록 작업해라."

# 리뷰 피드백이 있으면 프롬프트에 추가 (재시도 시)
if [ -n "$REVIEW_FEEDBACK_FILE" ] && [ -f "$REVIEW_FEEDBACK_FILE" ]; then
  FEEDBACK=$(cat "$REVIEW_FEEDBACK_FILE")
  PROMPT="${PROMPT}

## 이전 리뷰 피드백 (수정 요청)
아래는 이전 리뷰에서 받은 수정 요청이다. 반드시 이 피드백을 반영하여 작업해라:

${FEEDBACK}"
  echo "📝 이전 리뷰 피드백 포함"
fi

echo ""
echo "🚀 작업자 Agent 실행 중..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# claude 실행 (JSON 출력으로 토큰 사용량 캡처)
cd "$WORKTREE_PATH"
JSON_OUTPUT=$(claude -p "$PROMPT" --dangerously-skip-permissions --output-format json)

# 결과 텍스트 출력
echo "$JSON_OUTPUT" | jq -r '.result // empty'

# JSON 원본 저장
OUTPUT_DIR="$REPO_ROOT/output"
mkdir -p "$OUTPUT_DIR"
echo "$JSON_OUTPUT" | jq . > "$OUTPUT_DIR/${TASK_ID}-task.json"

# 토큰 사용량 기록
TOKEN_LOG="$OUTPUT_DIR/token-usage.log"

INPUT_TOKENS=$(echo "$JSON_OUTPUT" | jq '.usage.input_tokens // 0')
CACHE_CREATE=$(echo "$JSON_OUTPUT" | jq '.usage.cache_creation_input_tokens // 0')
CACHE_READ=$(echo "$JSON_OUTPUT" | jq '.usage.cache_read_input_tokens // 0')
OUTPUT_TOKENS=$(echo "$JSON_OUTPUT" | jq '.usage.output_tokens // 0')
COST=$(echo "$JSON_OUTPUT" | jq '.total_cost_usd // 0')
DURATION=$(echo "$JSON_OUTPUT" | jq '.duration_ms // 0')
NUM_TURNS=$(echo "$JSON_OUTPUT" | jq '.num_turns // 0')

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${TASK_ID} | phase=task | input=${INPUT_TOKENS} cache_create=${CACHE_CREATE} cache_read=${CACHE_READ} output=${OUTPUT_TOKENS} | turns=${NUM_TURNS} | duration=${DURATION}ms | cost=\$${COST}" >> "$TOKEN_LOG"

echo ""
echo "📊 토큰: in=${INPUT_TOKENS} cache_create=${CACHE_CREATE} cache_read=${CACHE_READ} out=${OUTPUT_TOKENS} | cost=\$${COST}"
