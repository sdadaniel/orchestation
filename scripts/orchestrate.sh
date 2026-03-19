#!/bin/bash
set -euo pipefail

# Usage: ./scripts/orchestrate.sh
# 의존 관계가 충족된 backlog 태스크를 찾아 iTerm 패널에서 실행

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASK_DIR="$REPO_ROOT/docs/task"

# ── 사전 검증 ──────────────────────────────────────────

if [ ! -d "$TASK_DIR" ]; then
  echo "❌ 태스크 디렉토리가 없습니다: $TASK_DIR" >&2
  exit 1
fi

if ! osascript -e 'tell application "System Events" to (name of processes) contains "iTerm2"' | grep -q true; then
  echo "❌ iTerm2가 실행 중이지 않습니다." >&2
  exit 1
fi

# ── frontmatter 파서 ──────────────────────────────────

get_field() {
  awk -v key="$2" '
    NR==1 && /^---$/ { in_fm=1; next }
    in_fm && /^---$/ { exit }
    in_fm && $0 ~ "^"key":" { sub("^"key":[ ]*", ""); print; exit }
  ' "$1"
}

get_list() {
  awk -v key="$2" '
    NR==1 && /^---$/ { in_fm=1; next }
    in_fm && /^---$/ { exit }
    in_fm && $0 ~ "^"key":" { in_list=1; next }
    in_list && /^  - / { sub(/^  - /, ""); print; next }
    in_list && /^[^ ]/ { exit }
  ' "$1"
}

# ── 실행 가능한 태스크 수집 ────────────────────────────

LAUNCH=()

for f in "$TASK_DIR"/TASK-*.md; do
  [ -f "$f" ] || continue

  status=$(get_field "$f" "status")
  [ "$status" != "backlog" ] && continue

  # 의존성 확인
  deps_ok=true
  while IFS= read -r dep; do
    [ -z "$dep" ] && continue
    dep_file=$(find "$TASK_DIR" -name "${dep}-*.md" -type f | head -1)
    [ -z "$dep_file" ] && { deps_ok=false; break; }
    dep_status=$(get_field "$dep_file" "status")
    [ "$dep_status" != "done" ] && { deps_ok=false; break; }
  done <<< "$(get_list "$f" "depends_on")"

  if [ "$deps_ok" = true ]; then
    task_id=$(get_field "$f" "id")
    title=$(get_field "$f" "title")
    LAUNCH+=("$task_id|$title")
  fi
done

# ── 결과 ──────────────────────────────────────────────

if [ ${#LAUNCH[@]} -eq 0 ]; then
  echo "실행 가능한 태스크가 없습니다."
  exit 0
fi

echo "🎼 ${#LAUNCH[@]}개 태스크 실행"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for entry in "${LAUNCH[@]}"; do
  task_id="${entry%%|*}"
  title="${entry#*|}"

  echo "  ▶ ${task_id}: ${title}"

  cmd="cd ${REPO_ROOT} && bash scripts/run-pipeline.sh ${task_id}"

  osascript <<EOF
tell application "iTerm"
    if (count of windows) = 0 then
        create window with default profile
    end if
    tell current session of current window
        split vertically with same profile command "/bin/zsh -lc '${cmd}; echo; echo \"[완료] 패널을 닫으려면 exit\"; exec /bin/zsh -l'"
    end tell
end tell
EOF
done

echo ""
echo "✅ iTerm 패널에서 실행 중. 진행 상황은 각 패널에서 확인하세요."
