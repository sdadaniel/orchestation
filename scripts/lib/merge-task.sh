#!/bin/bash
set -euo pipefail

# Usage: merge-task.sh TASK-XXX
# worktree 브랜치를 main에 머지하고 worktree를 정리한다.
# Exit: 0=성공, 1=실패

TASK_ID="${1:?Usage: merge-task.sh TASK-XXX}"
PACKAGE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
REPO_ROOT="$PROJECT_ROOT"  # backward compat alias
export PACKAGE_DIR PROJECT_ROOT

source "$PACKAGE_DIR/scripts/lib/common.sh"
source "$PACKAGE_DIR/scripts/lib/sed-inplace.sh"
source "$PACKAGE_DIR/scripts/lib/merge-resolver.sh"

# ── BASE_BRANCH 결정 ──
CONFIG_FILE="$PROJECT_ROOT/.orchestration/config.json"
if [ -z "${BASE_BRANCH:-}" ]; then
  if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
    BASE_BRANCH=$(jq -r '.baseBranch // "main"' "$CONFIG_FILE" 2>/dev/null || echo "main")
  else
    BASE_BRANCH="main"
  fi
fi
[ -z "${BASE_BRANCH:-}" ] && BASE_BRANCH="main"

# ── 디렉토리 설정 ──
if [ -d "$REPO_ROOT/.orchestration/tasks" ]; then
  TASK_DIR="$REPO_ROOT/.orchestration/tasks"
else
  TASK_DIR="$REPO_ROOT/docs/task"
fi
REQ_DIR="$REPO_ROOT/docs/requests"

# ── 태스크 파일 찾기 ──
find_file() {
  local id="$1"
  local f=""
  f=$(find "$TASK_DIR" -name "${id}-*.md" 2>/dev/null | head -1)
  if [ -z "$f" ]; then
    f=$(find "$REQ_DIR" -name "${id}-*.md" 2>/dev/null | head -1)
  fi
  echo "$f"
}

TASK_FILE=$(find_file "$TASK_ID")
if [ -z "$TASK_FILE" ]; then
  echo "❌ Task 파일을 찾을 수 없습니다: ${TASK_ID}" >&2
  exit 1
fi

BRANCH=$(get_field "$TASK_FILE" "branch")
WORKTREE_REL=$(get_field "$TASK_FILE" "worktree")
WORKTREE_PATH="$REPO_ROOT/$WORKTREE_REL"

if [ -z "$BRANCH" ]; then
  echo "❌ branch 필드가 없습니다: ${TASK_ID}" >&2
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔀 [merge-task] ${TASK_ID}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌿 Branch: $BRANCH → $BASE_BRANCH"

# ── main 체크아웃 확인 ──
CURRENT_BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BASE_BRANCH" ]; then
  git -C "$REPO_ROOT" checkout "$BASE_BRANCH"
fi

# ── 로컬 변경 보호 (stash) ──
_stashed=false
if ! git -C "$REPO_ROOT" diff --quiet 2>/dev/null || ! git -C "$REPO_ROOT" diff --cached --quiet 2>/dev/null; then
  git -C "$REPO_ROOT" stash push -m "merge-task-${TASK_ID}" --include-untracked 2>/dev/null && _stashed=true
  echo "  📦 로컬 변경 stash 완료"
fi

# ── 머지 ──
_merge_ok=true
if git -C "$REPO_ROOT" log --oneline "${BASE_BRANCH}..$BRANCH" 2>/dev/null | grep -q .; then
  echo "  🔀 ${TASK_ID}: $BRANCH → ${BASE_BRANCH} 머지"
  if ! git -C "$REPO_ROOT" merge "$BRANCH" --no-ff --no-edit; then
    if ! resolve_merge_conflict "$REPO_ROOT" "$TASK_ID" "$BRANCH" "$BASE_BRANCH"; then
      echo "  ❌ 머지 실패 (충돌 해결 불가)" >&2
      _merge_ok=false
    fi
  fi
else
  echo "  ℹ️  머지할 커밋 없음"
fi

# ── stash 복원 ──
if [ "$_stashed" = true ]; then
  git -C "$REPO_ROOT" stash pop 2>/dev/null || true
  echo "  📦 stash 복원 완료"
fi

if [ "$_merge_ok" = false ]; then
  exit 1
fi

# ── 브랜치 정리 ──
git -C "$REPO_ROOT" branch -d "$BRANCH" 2>/dev/null || true

# ── Worktree 정리 ──
if [ -d "$WORKTREE_PATH" ]; then
  git -C "$REPO_ROOT" worktree remove "$WORKTREE_PATH" --force 2>/dev/null || true
fi

# ── status → done ──
sed_inplace "s/^status: .*/status: done/" "$TASK_FILE"
git -C "$REPO_ROOT" add "$TASK_FILE"
git -C "$REPO_ROOT" commit --only "$TASK_FILE" -m "chore(${TASK_ID}): status → done" || true

echo "✅ [merge-task] ${TASK_ID} 완료 → ${BASE_BRANCH}에 머지됨"
