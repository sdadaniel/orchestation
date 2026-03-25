#!/bin/bash
set -euo pipefail

# Usage: ./scripts/archive-tasks.sh
# status: done인 태스크를 docs/task/archive/로 이동

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -d "$REPO_ROOT/.orchestration/tasks" ]; then
  TASK_DIR="$REPO_ROOT/.orchestration/tasks"
else
  TASK_DIR="$REPO_ROOT/docs/task"
fi
ARCHIVE_DIR="$TASK_DIR/archive"

mkdir -p "$ARCHIVE_DIR"

MOVED=0

for f in "$TASK_DIR"/TASK-*.md; do
  [ -f "$f" ] || continue
  status=$(awk 'NR==1 && /^---$/{in_fm=1;next} in_fm && /^---$/{exit} in_fm && /^status:/{sub(/^status:[ ]*/, ""); print; exit}' "$f")
  if [ "$status" = "done" ]; then
    filename=$(basename "$f")
    mv "$f" "$ARCHIVE_DIR/$filename"
    echo "  📦 $filename → archive/"
    MOVED=$((MOVED + 1))
  fi
done

if [ "$MOVED" -eq 0 ]; then
  echo "아카이브할 태스크가 없습니다."
else
  echo ""
  echo "✅ ${MOVED}개 태스크 아카이브 완료"
fi
