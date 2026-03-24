#!/bin/bash
set -euo pipefail

# Usage: ./scripts/orchestrate.sh
# 의존 관계에 따라 태스크를 배치로 수집하고,
# 병렬 태스크는 각각 별도 iTerm 패널에서 실행

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASK_DIR="$REPO_ROOT/docs/task"
REQ_DIR="$REPO_ROOT/docs/requests"
MAX_REVIEW_RETRY=10
MAX_PARALLEL="${MAX_PARALLEL:-3}"
SIGNAL_DIR="/tmp/orchestrate-$$"
mkdir -p "$SIGNAL_DIR"

# ── 중복 실행 방지 (lock) ─────────────────────────────
LOCK_DIR="/tmp/orchestrate.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "⚠️  orchestrate.sh가 이미 실행 중입니다. 중복 실행 방지."
  exit 0
fi

cleanup_lock() {
  rm -rf "$SIGNAL_DIR" "$LOCK_DIR"
}
trap cleanup_lock EXIT

# ── 사전 검증 ──────────────────────────────────────────

if [ ! -d "$TASK_DIR" ]; then
  echo "❌ 태스크 디렉토리가 없습니다: $TASK_DIR" >&2
  exit 1
fi

if ! osascript -e 'tell application "System Events" to (name of processes) contains "iTerm2"' | grep -q true; then
  echo "❌ iTerm2가 실행 중이지 않습니다." >&2
  exit 1
fi

# ── 사전 검증 (계속) ──────────────────────────────────

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
    in_list && /^ +- / { sub(/^ +- /, ""); print; next }
    in_list && /^[^ ]/ { exit }
  ' "$1"
}

# ── 헬퍼 함수 ─────────────────────────────────────────

get_task_ids() {
  # docs/task/ + docs/requests/ 둘 다 스캔
  # priority 순 정렬: high(1) → medium(2) → low(3) → 기타(4), 동일 priority 내 id순
  {
    find "$TASK_DIR" -name "TASK-*.md" 2>/dev/null
    find "$REQ_DIR" -name "REQ-*.md" 2>/dev/null
  } | while read -r f; do
    local id pri weight
    id=$(get_field "$f" "id")
    pri=$(get_field "$f" "priority")
    case "$pri" in
      high)   weight=1 ;;
      medium) weight=2 ;;
      low)    weight=3 ;;
      *)      weight=4 ;;
    esac
    echo "${weight} ${id}"
  done | sort -k1,1n -k2,2 | awk '{print $2}'
}

# docs/task/ 또는 docs/requests/ 에서 파일 찾기
find_file() {
  local id="$1"
  local f=""
  f=$(find "$TASK_DIR" -name "${id}-*.md" 2>/dev/null | head -1)
  if [ -z "$f" ]; then
    f=$(find "$REQ_DIR" -name "${id}-*.md" 2>/dev/null | head -1)
  fi
  echo "$f"
}

get_status() {
  local task_id="$1"
  local task_file
  task_file=$(find_file "$task_id")
  if [ -z "$task_file" ]; then echo "unknown"; return; fi
  get_field "$task_file" "status"
}

get_branch() {
  local task_id="$1"
  local task_file
  task_file=$(find_file "$task_id")
  if [ -z "$task_file" ]; then return; fi
  get_field "$task_file" "branch"
}

get_worktree() {
  local task_id="$1"
  local task_file
  task_file=$(find_file "$task_id")
  if [ -z "$task_file" ]; then return; fi
  local rel
  rel=$(get_field "$task_file" "worktree")
  echo "$REPO_ROOT/$rel"
}

deps_satisfied() {
  local task_id="$1"
  local deps
  deps=$(
    local tf
    tf=$(find_file "$task_id")
    [ -n "$tf" ] && get_list "$tf" "depends_on"
  )

  if [ -z "$deps" ]; then
    return 0
  fi

  while IFS= read -r dep; do
    [ -z "$dep" ] && continue
    local dep_status
    dep_status=$(get_status "$dep")
    if [ "$dep_status" != "done" ]; then
      return 1
    fi
  done <<< "$deps"
  return 0
}

# ── 메인 파이프라인 루프 ──────────────────────────────

echo "🚀 Pipeline 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

while true; do
  BATCH=()

  # 실행 가능한 TASK 수집 (pending + 의존 충족)
  while IFS= read -r task_id; do
    [ -z "$task_id" ] && continue
    status=$(get_status "$task_id")
    [ "$status" != "pending" ] && continue
    if deps_satisfied "$task_id"; then
      BATCH+=("$task_id")
    fi
  done <<< "$(get_task_ids)"

  # 더 이상 실행할 TASK가 없으면 종료
  if [ ${#BATCH[@]} -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Pipeline 완료!"

    REMAINING=0
    while IFS= read -r task_id; do
      [ -z "$task_id" ] && continue
      status=$(get_status "$task_id")
      if [ "$status" == "pending" ]; then
        REMAINING=$((REMAINING + 1))
      fi
    done <<< "$(get_task_ids)"

    if [ "$REMAINING" -gt 0 ]; then
      echo "⚠️  의존 관계가 충족되지 않아 실행되지 못한 TASK: ${REMAINING}개"
    fi
    break
  fi

  echo ""
  echo "▶ 병렬 실행: ${BATCH[*]} (MAX_PARALLEL=${MAX_PARALLEL})"
  echo ""

  # ── 배치를 MAX_PARALLEL 크기 청크로 분할 실행 ──

  total=${#BATCH[@]}
  offset=0

  while [ "$offset" -lt "$total" ]; do
    CHUNK=("${BATCH[@]:$offset:$MAX_PARALLEL}")
    offset=$((offset + MAX_PARALLEL))

    if [ "$total" -gt "$MAX_PARALLEL" ]; then
      echo "  📦 청크 실행: ${CHUNK[*]} (${#CHUNK[@]}/${total})"
    fi

    # ── status → in_progress ──
    IN_PROGRESS_FILES=()
    for task_id in "${CHUNK[@]}"; do
      tf=$(find_file "$task_id")
      if [ -n "$tf" ]; then
        sed -i '' "s/^status: pending/status: in_progress/" "$tf"
        IN_PROGRESS_FILES+=("$tf")
      fi
    done
    if [ ${#IN_PROGRESS_FILES[@]} -gt 0 ]; then
      git -C "$REPO_ROOT" add "${IN_PROGRESS_FILES[@]}"
      CHUNK_LABEL=$(IFS=,; echo "${CHUNK[*]}")
      git -C "$REPO_ROOT" commit -m "chore(${CHUNK_LABEL}): status → in_progress"
    fi

    # ── 각 태스크를 별도 iTerm 패널에서 실행 ──

    for task_id in "${CHUNK[@]}"; do
      echo "  🔧 ${task_id}: iTerm 패널 열기..."

      # 완료 시그널 파일 경로
      done_signal="${SIGNAL_DIR}/${task_id}-done"
      fail_signal="${SIGNAL_DIR}/${task_id}-failed"

      # run-worker.sh: run-task.sh → run-review.sh (리뷰 실패 시 최대 MAX_REVIEW_RETRY회 재시도)
      mkdir -p "$REPO_ROOT/output/logs"
      log_file="$REPO_ROOT/output/logs/${task_id}.log"
      cmd="bash ${REPO_ROOT}/scripts/run-worker.sh ${task_id} ${SIGNAL_DIR} ${MAX_REVIEW_RETRY} 2>&1 | tee ${log_file}"

      osascript <<EOF
tell application "iTerm"
    if (count of windows) = 0 then
        create window with default profile
    end if
    tell current session of current window
        split vertically with same profile command "/bin/zsh -lc '${cmd}; echo; echo done - exit to close; exec /bin/zsh -l'"
    end tell
end tell
EOF
    done

    # ── 청크 내 모든 태스크 완료 대기 ──

    echo ""
    echo "  ⏳ ${#CHUNK[@]}개 태스크 완료 대기 중..."

    FAILED=0
    while true; do
      all_done=true
      for task_id in "${CHUNK[@]}"; do
        if [ ! -f "${SIGNAL_DIR}/${task_id}-done" ] && [ ! -f "${SIGNAL_DIR}/${task_id}-failed" ]; then
          all_done=false
          break
        fi
      done
      if [ "$all_done" = true ]; then
        break
      fi
      sleep 2
    done

    # ── 결과 처리: 머지 + 상태 업데이트 ──

    for task_id in "${CHUNK[@]}"; do
      if [ -f "${SIGNAL_DIR}/${task_id}-done" ]; then
        echo "  ✅ ${task_id} 완료"

        # status → done
        local_task_file=$(find_file "$task_id")
        if [ -n "$local_task_file" ]; then
          sed -i '' "s/^status: .*/status: done/" "$local_task_file"
        fi

        # worktree 제거
        wt_path=$(get_worktree "$task_id")
        if [ -d "$wt_path" ]; then
          git -C "$REPO_ROOT" worktree remove "$wt_path" --force 2>/dev/null || true
        fi

        # main에 머지
        branch=$(get_branch "$task_id")
        if [ -n "$branch" ]; then
          if git -C "$REPO_ROOT" log --oneline "main..$branch" 2>/dev/null | grep -q .; then
            echo "  🔀 ${task_id}: $branch → main 머지"
            git -C "$REPO_ROOT" merge "$branch" --no-ff --no-edit
          fi
          git -C "$REPO_ROOT" branch -d "$branch" 2>/dev/null || true
        fi

        # 태스크 상태 변경 커밋
        if [ -n "$local_task_file" ]; then
          git -C "$REPO_ROOT" add "$local_task_file"
          git -C "$REPO_ROOT" commit -m "chore(${task_id}): status → done"
        fi
      else
        echo "  ❌ ${task_id} 실패"
        FAILED=1
      fi

      # 시그널 파일 정리
      rm -f "${SIGNAL_DIR}/${task_id}-done" "${SIGNAL_DIR}/${task_id}-failed"
    done

    if [ "$FAILED" -eq 1 ]; then
      echo ""
      echo "❌ 실패한 TASK가 있어 Pipeline을 중단합니다."
      exit 1
    fi

  done  # end CHUNK loop
done

echo ""
echo "✅ 모든 태스크 완료. iTerm 패널에서 확인하세요."
