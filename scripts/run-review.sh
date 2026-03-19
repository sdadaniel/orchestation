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

# Reviewer 프롬프트 구성
PROMPT="너는 Reviewer(검증자) 역할이다. 아래 규칙을 반드시 따라라:
- 코드를 직접 수정하지 않는다
- Task 파일의 완료 조건을 기준으로 검증한다

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

# claude 실행
cd "$WORKTREE_PATH"
RESULT=$(claude -p "$PROMPT" --dangerously-skip-permissions)

echo "$RESULT"

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
