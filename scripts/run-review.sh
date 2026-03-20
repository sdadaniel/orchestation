#!/bin/bash
set -euo pipefail

# Usage: ./scripts/run-review.sh TASK-001

TASK_ID="${1:?Usage: ./scripts/run-review.sh TASK-XXX}"
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
WORKTREE_PATH="$REPO_ROOT/$WORKTREE_REL"

if [ -z "$BRANCH" ]; then
  echo "❌ Task 파일에 branch가 정의되지 않았습니다"
  exit 1
fi

# worktree 존재 확인
if [ ! -d "$WORKTREE_PATH" ]; then
  echo "❌ Worktree가 존재하지 않습니다: $WORKTREE_PATH"
  echo "   먼저 ./scripts/run-task.sh ${TASK_ID} 를 실행하세요"
  exit 1
fi

echo "🌿 Branch: $BRANCH"
echo "📂 Worktree: $WORKTREE_PATH"

# reviewer role 프롬프트 로드
REVIEWER_ROLE=$(grep '^reviewer_role:' "$TASK_FILE" | sed 's/reviewer_role: *//')
ROLE_DIR="$REPO_ROOT/docs/roles"
ROLE_PROMPT=""

if [ -n "$REVIEWER_ROLE" ] && [ -f "$ROLE_DIR/${REVIEWER_ROLE}.md" ]; then
  ROLE_PROMPT=$(cat "$ROLE_DIR/${REVIEWER_ROLE}.md")
  echo "🎭 Reviewer Role: $REVIEWER_ROLE"
elif [ -n "$REVIEWER_ROLE" ] && [ ! -f "$ROLE_DIR/${REVIEWER_ROLE}.md" ]; then
  echo "⚠️  Reviewer Role '${REVIEWER_ROLE}' 파일 없음 → reviewer-general 사용"
  ROLE_PROMPT=$(cat "$ROLE_DIR/reviewer-general.md")
else
  ROLE_PROMPT=$(cat "$ROLE_DIR/reviewer-general.md")
  echo "🎭 Reviewer Role: reviewer-general (기본)"
fi

# Reviewer 프롬프트 구성
PROMPT="${ROLE_PROMPT}

## 리뷰 규칙
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

echo ""
echo "🔍 Reviewer Agent 실행 중..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# claude 실행 (JSON 출력으로 토큰 사용량 캡처)
cd "$WORKTREE_PATH"
JSON_OUTPUT=$(claude -p "$PROMPT" --dangerously-skip-permissions --output-format json)

# 결과 텍스트 추출
RESULT=$(echo "$JSON_OUTPUT" | jq -r '.result // empty')
echo "$RESULT"

# JSON 원본 저장
OUTPUT_DIR="$REPO_ROOT/output"
mkdir -p "$OUTPUT_DIR"
echo "$JSON_OUTPUT" | jq . > "$OUTPUT_DIR/${TASK_ID}-review.json"

# 리뷰 피드백 저장 (재시도 시 작업자에게 전달용)
FEEDBACK_FILE="$OUTPUT_DIR/${TASK_ID}-review-feedback.txt"
echo "$RESULT" > "$FEEDBACK_FILE"

# 토큰 사용량 기록
TOKEN_LOG="$OUTPUT_DIR/token-usage.log"

INPUT_TOKENS=$(echo "$JSON_OUTPUT" | jq '.usage.input_tokens // 0')
CACHE_CREATE=$(echo "$JSON_OUTPUT" | jq '.usage.cache_creation_input_tokens // 0')
CACHE_READ=$(echo "$JSON_OUTPUT" | jq '.usage.cache_read_input_tokens // 0')
OUTPUT_TOKENS=$(echo "$JSON_OUTPUT" | jq '.usage.output_tokens // 0')
COST=$(echo "$JSON_OUTPUT" | jq '.total_cost_usd // 0')
DURATION=$(echo "$JSON_OUTPUT" | jq '.duration_ms // 0')
NUM_TURNS=$(echo "$JSON_OUTPUT" | jq '.num_turns // 0')

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${TASK_ID} | phase=review | input=${INPUT_TOKENS} cache_create=${CACHE_CREATE} cache_read=${CACHE_READ} output=${OUTPUT_TOKENS} | turns=${NUM_TURNS} | duration=${DURATION}ms | cost=\$${COST}" >> "$TOKEN_LOG"

echo ""
echo "📊 토큰: in=${INPUT_TOKENS} cache_create=${CACHE_CREATE} cache_read=${CACHE_READ} out=${OUTPUT_TOKENS} | cost=\$${COST}"

# 승인 여부 판단
if echo "$RESULT" | grep -q "승인"; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ 리뷰 승인됨"
  exit 0
else
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 수정 요청됨"
  exit 1
fi
