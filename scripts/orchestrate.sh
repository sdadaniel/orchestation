#!/bin/bash
set -euo pipefail

# Usage: ./scripts/orchestrate.sh
# 의존 관계에 따라 태스크를 배치로 수집하고,
# 병렬 태스크는 각각 별도 iTerm 패널에서 실행

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$REPO_ROOT/scripts/lib/sed-inplace.sh"
source "$REPO_ROOT/scripts/lib/merge-resolver.sh"
TASK_DIR="$REPO_ROOT/docs/task"
REQ_DIR="$REPO_ROOT/docs/requests"
MAX_REVIEW_RETRY="${MAX_REVIEW_RETRY:-2}"
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
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🛑 Pipeline 종료"
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
  # 완료(done)/in_progress 태스크는 조기 제외하여 불필요한 처리 방지
  # priority 순 정렬: high(1) → medium(2) → low(3) → 기타(4), 동일 priority 내 id순
  {
    find "$TASK_DIR" -maxdepth 1 -name "TASK-*.md" 2>/dev/null
    find "$REQ_DIR" -maxdepth 1 -name "REQ-*.md" 2>/dev/null
  } | while read -r f; do
    local id pri st weight sort_ord status_weight 2>/dev/null || true
    id=$(get_field "$f" "id")
    pri=$(get_field "$f" "priority")
    st=$(get_field "$f" "status")
    # 완료/진행 중 태스크 조기 제외
    case "$st" in
      done|in_progress) continue ;;
    esac
    sort_ord=$(get_field "$f" "sort_order")
    sort_ord="${sort_ord:-0}"
    # stopped(0)가 pending(1)보다 우선
    case "$st" in
      stopped) status_weight=0 ;;
      *)       status_weight=1 ;;
    esac
    case "$pri" in
      high)   weight=1 ;;
      medium) weight=2 ;;
      low)    weight=3 ;;
      *)      weight=4 ;;
    esac
    printf "%s %s %04d %s\n" "${status_weight}" "${weight}" "${sort_ord}" "${id}"
  done | sort -k1,1n -k2,2n -k3,3n -k4,4 | awk '{print $4}'
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

# 실패한 태스크에 의존하는 pending 태스크들을 stopped로 전환 (재귀)
stop_dependents() {
  local failed_id="$1"

  while IFS= read -r tid; do
    [ -z "$tid" ] && continue
    local tf
    tf=$(find_file "$tid")
    [ -z "$tf" ] && continue

    local st
    st=$(get_field "$tf" "status")
    [ "$st" != "pending" ] && continue

    local deps
    deps=$(get_list "$tf" "depends_on")
    if echo "$deps" | grep -q "$failed_id"; then
      echo "  ⏸️  ${tid}: 의존 태스크 ${failed_id} 실패 → stopped"
      sed_inplace "s/^status: .*/status: stopped/" "$tf"
      git -C "$REPO_ROOT" add "$tf"
      git -C "$REPO_ROOT" commit --only "$tf" \
        -m "chore(${tid}): status → stopped (dependency ${failed_id} failed)"
      # 재귀: 이 태스크에 의존하는 것도 중단
      stop_dependents "$tid"
    fi
  done <<< "$(get_task_ids)"
}

# ── 태스크 시작 헬퍼 ──────────────────────────────────

start_task() {
  local task_id="$1"
  echo "  🔧 ${task_id}: 시작..."

  # branch/worktree 필드가 없으면 자동 추가
  local tf
  tf=$(find_file "$task_id")
  if [ -n "$tf" ] && ! grep -q '^branch:' "$tf"; then
    local slug
    slug=$(echo "$task_id" | tr '[:upper:]' '[:lower:]')
    local tmpfile
    tmpfile=$(mktemp)
    awk '/^status:/{print; print "branch: task/'"${slug}"'"; print "worktree: ../repo-wt-'"${slug}"'"; next} 1' "$tf" > "$tmpfile"
    mv "$tmpfile" "$tf"
    echo "  📝 ${task_id}: branch/worktree 필드 자동 추가"
  fi

  # status → in_progress
  if [ -n "$tf" ]; then
    sed_inplace_E "s/^status: (pending|stopped)/status: in_progress/" "$tf"
    git -C "$REPO_ROOT" add "$tf"
    git -C "$REPO_ROOT" commit --only "$tf" -m "chore(${task_id}): status → in_progress"
  fi

  # iTerm 패널에서 실행
  mkdir -p "$REPO_ROOT/output/logs"
  local log_file="$REPO_ROOT/output/logs/${task_id}.log"
  local cmd="bash '${REPO_ROOT}/scripts/run-worker.sh' '${task_id}' '${SIGNAL_DIR}' '${MAX_REVIEW_RETRY}' 2>&1 | tee '${log_file}'; bash '${REPO_ROOT}/scripts/lib/close-iterm-session.sh'"

  osascript <<EOF
tell application "iTerm"
    if (count of windows) = 0 then
        create window with default profile
    end if
    tell current session of current window
        set newSession to (split vertically with same profile)
        tell newSession
            write text "${cmd}"
        end tell
    end tell
end tell
EOF
}

# 완료된 태스크 처리 (머지 + 상태 업데이트)
process_done_task() {
  local task_id="$1"

  if [ -f "${SIGNAL_DIR}/${task_id}-done" ]; then
    echo "  ✅ ${task_id} 완료"

    local local_task_file
    local_task_file=$(find_file "$task_id")
    if [ -n "$local_task_file" ]; then
      sed_inplace "s/^status: .*/status: done/" "$local_task_file"
    fi

    local wt_path
    wt_path=$(get_worktree "$task_id")
    if [ -d "$wt_path" ]; then
      git -C "$REPO_ROOT" worktree remove "$wt_path" --force 2>/dev/null || true
    fi

    local branch
    branch=$(get_branch "$task_id")
    if [ -n "$branch" ]; then
      if git -C "$REPO_ROOT" log --oneline "main..$branch" 2>/dev/null | grep -q .; then
        echo "  🔀 ${task_id}: $branch → main 머지"
        if ! git -C "$REPO_ROOT" merge "$branch" --no-ff --no-edit; then
          # 머지 충돌 → Claude로 자동 해결 시도
          if ! resolve_merge_conflict "$REPO_ROOT" "$task_id" "$branch"; then
            # 해결 실패 → failed 처리 + 의존 태스크 연쇄 중단
            sed_inplace "s/^status: .*/status: failed/" "$local_task_file"
            git -C "$REPO_ROOT" add "$local_task_file"
            git -C "$REPO_ROOT" commit --only "$local_task_file" \
              -m "chore(${task_id}): status → failed (merge conflict)"
            git -C "$REPO_ROOT" branch -d "$branch" 2>/dev/null || true
            rm -f "${SIGNAL_DIR}/${task_id}-done"
            stop_dependents "$task_id"
            return 1
          fi
        fi
      fi
      git -C "$REPO_ROOT" branch -d "$branch" 2>/dev/null || true
    fi

    if [ -n "$local_task_file" ]; then
      git -C "$REPO_ROOT" add "$local_task_file"
      git -C "$REPO_ROOT" commit --only "$local_task_file" -m "chore(${task_id}): status → done"
    fi

    # 완료 Notice
    local task_title
    task_title=$(get_field "$local_task_file" "title")
    post_notice "info" \
      "${task_id} 완료" \
      "**${task_id}:** ${task_title}\n\n태스크가 성공적으로 완료되어 main에 머지되었습니다."

    rm -f "${SIGNAL_DIR}/${task_id}-done"
    return 0
  elif [ -f "${SIGNAL_DIR}/${task_id}-failed" ]; then
    echo "  ❌ ${task_id} 실패 (review retry 상한 초과)"

    # 태스크를 failed 상태로 마킹 + 마지막 리뷰 피드백 기록
    local failed_task_file
    failed_task_file=$(find_file "$task_id")
    if [ -n "$failed_task_file" ]; then
      sed_inplace "s/^status: .*/status: failed/" "$failed_task_file"

      git -C "$REPO_ROOT" add "$failed_task_file"
      git -C "$REPO_ROOT" commit --only "$failed_task_file" -m "chore(${task_id}): status → failed (review retry 상한 초과)" || true
    fi

    # worktree + 브랜치 정리
    local failed_wt_path
    failed_wt_path=$(get_worktree "$task_id")
    if [ -d "$failed_wt_path" ]; then
      git -C "$REPO_ROOT" worktree remove "$failed_wt_path" --force 2>/dev/null || true
    fi
    local failed_branch
    failed_branch=$(get_branch "$task_id")
    if [ -n "$failed_branch" ]; then
      git -C "$REPO_ROOT" branch -D "$failed_branch" 2>/dev/null || true
    fi

    # 실패 Notice
    local failed_title
    failed_title=$(get_field "$failed_task_file" "title")
    post_notice "error" \
      "${task_id} 실패" \
      "**${task_id}:** ${failed_title}\n\n리뷰 retry 상한 초과로 실패했습니다. 리뷰 피드백을 확인해주세요."

    rm -f "${SIGNAL_DIR}/${task_id}-failed"
    # 의존 태스크 연쇄 중단
    stop_dependents "$task_id"
    return 1
  fi
  return 2  # 아직 진행 중
}

# ── 메인 파이프라인 (슬롯 기반) ──────────────────────

echo "🚀 Pipeline 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RUNNING=()   # 현재 실행 중인 태스크 ID 목록
FAILED_COUNT=0

while true; do
  # ── 실행 중인 태스크 완료 여부 체크 (슬롯 투입 전에 먼저 갱신) ──
  if [ "${#RUNNING[@]}" -gt 0 ]; then
    NEW_RUNNING=()
    for task_id in "${RUNNING[@]}"; do
      [ -z "$task_id" ] && continue
      rc=0
      process_done_task "$task_id" || rc=$?
      if [ "$rc" -eq 2 ]; then
        # 아직 진행 중
        NEW_RUNNING+=("$task_id")
      elif [ "$rc" -eq 1 ]; then
        # 실패
        FAILED_COUNT=$((FAILED_COUNT + 1))
      fi
      # rc=0 (성공)이면 RUNNING에서 제거됨
    done
    # 빈 배열 안전 처리 (bash 3.2 호환)
    if [ "${#NEW_RUNNING[@]}" -gt 0 ]; then
      RUNNING=("${NEW_RUNNING[@]}")
    else
      RUNNING=()
    fi
  fi

  # ── 실행 가능한 태스크 큐 갱신 ──
  QUEUE=()
  while IFS= read -r task_id; do
    [ -z "$task_id" ] && continue
    local_status=$(get_status "$task_id")
    [ "$local_status" != "pending" ] && [ "$local_status" != "stopped" ] && continue
    if deps_satisfied "$task_id"; then
      QUEUE+=("$task_id")
    fi
  done <<< "$(get_task_ids)"

  # 실행 중인 것도 없고 대기 큐도 비었으면 → 새 태스크 대기
  if [ "${#RUNNING[@]}" -eq 0 ] && [ "${#QUEUE[@]}" -eq 0 ]; then
    if [ "$FAILED_COUNT" -gt 0 ]; then
      echo "  ⚠️  실패한 태스크: ${FAILED_COUNT}개"
      FAILED_COUNT=0
    fi
    echo "  ⏳ 새 태스크 대기 중... (30초마다 스캔)"
    sleep 30
    continue
  fi

  # ── 빈 슬롯에 새 태스크 투입 ──
  qi=0
  echo "  🔍 슬롯 체크: RUNNING=${#RUNNING[@]}/${MAX_PARALLEL}, QUEUE=${#QUEUE[@]}"
  while [ "${#RUNNING[@]}" -lt "$MAX_PARALLEL" ] && [ "$qi" -lt "${#QUEUE[@]}" ]; do
    next_task="${QUEUE[$qi]}"
    qi=$((qi + 1))

    # 이미 실행 중인지 확인
    already_running=false
    for rt in "${RUNNING[@]+"${RUNNING[@]}"}"; do
      if [ "$rt" == "$next_task" ]; then
        already_running=true
        break
      fi
    done
    if $already_running; then continue; fi

    start_task "$next_task"
    RUNNING+=("$next_task")
    echo "  📊 슬롯: ${#RUNNING[@]}/${MAX_PARALLEL} (대기: $((${#QUEUE[@]} - qi)))"
  done

  sleep 2
done
