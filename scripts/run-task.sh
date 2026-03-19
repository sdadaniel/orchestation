#!/bin/bash
set -euo pipefail

# Usage: ./scripts/run-task.sh TASK-001

TASK_ID="${1:?Usage: ./scripts/run-task.sh TASK-XXX}"
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

# 작업자 프롬프트 구성
PROMPT="너는 작업자 역할이다. 아래 규칙을 반드시 따라라:
- 이 Worktree 안에서만 코드를 수정한다
- main 브랜치를 직접 수정하지 않는다
- Task 상태를 완료 처리하지 않는다
- 작업이 끝나면 변경사항을 커밋해라

지금 수행할 Task는 docs/task/${TASK_FILENAME} 에 정의되어 있다.
해당 파일을 읽고, 완료 조건을 모두 충족하도록 작업해라."

echo ""
echo "🚀 작업자 Agent 실행 중..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# claude 실행
cd "$WORKTREE_PATH"
claude -p "$PROMPT" --dangerously-skip-permissions
