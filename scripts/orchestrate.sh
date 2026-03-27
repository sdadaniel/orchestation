#!/bin/bash
set -euo pipefail

# Usage: ./scripts/orchestrate.sh
# 의존 관계에 따라 태스크를 배치로 수집하고,
# 병렬 태스크는 각각 별도 iTerm 패널에서 실행

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$REPO_ROOT/scripts/lib/common.sh"
source "$REPO_ROOT/scripts/lib/sed-inplace.sh"
source "$REPO_ROOT/scripts/lib/merge-resolver.sh"
# .orchestration/tasks를 우선, 없으면 docs/task fallback
if [ -d "$REPO_ROOT/.orchestration/tasks" ]; then
  TASK_DIR="$REPO_ROOT/.orchestration/tasks"
else
  TASK_DIR="$REPO_ROOT/docs/task"
fi
REQ_DIR="$REPO_ROOT/docs/requests"
MAX_REVIEW_RETRY="${MAX_REVIEW_RETRY:-2}"
MAX_PARALLEL_TASK="${MAX_PARALLEL_TASK:-2}"
MAX_PARALLEL_REVIEW="${MAX_PARALLEL_REVIEW:-2}"
MAX_CLAUDE_PROCS="${MAX_CLAUDE_PROCS:-4}"
SIGNAL_DIR="$REPO_ROOT/.orchestration/signals"
mkdir -p "$SIGNAL_DIR"
LAST_DISPATCH_TIME=0
# 이전 실행의 남은 시그널 정리하지 않음 — 재시작 시 이전 done/failed 시그널 처리 가능

# ── workerMode 결정 (환경변수 > config.json > 기본값 background) ──
CONFIG_FILE="$REPO_ROOT/config.json"
if [ -z "${WORKER_MODE:-}" ]; then
  if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
    WORKER_MODE=$(jq -r '.workerMode // "background"' "$CONFIG_FILE" 2>/dev/null || echo "background")
  elif [ -f "$CONFIG_FILE" ]; then
    WORKER_MODE=$(awk -F'"' '/"workerMode"/{print $4; exit}' "$CONFIG_FILE" 2>/dev/null || echo "background")
  else
    WORKER_MODE="background"
  fi
fi
case "$WORKER_MODE" in
  background|iterm) ;;
  *) echo "⚠️  WORKER_MODE '${WORKER_MODE}' 무효 → background 사용"; WORKER_MODE="background" ;;
esac
echo "⚙️  Worker 실행 모드: ${WORKER_MODE}"

# ── BASE_BRANCH 결정 (환경변수 > config.json > 기본값 main) ──
if [ -z "${BASE_BRANCH:-}" ]; then
  if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
    BASE_BRANCH=$(jq -r '.baseBranch // "main"' "$CONFIG_FILE" 2>/dev/null || echo "main")
  elif [ -f "$CONFIG_FILE" ]; then
    BASE_BRANCH=$(awk -F'"' '/"baseBranch"/{print $4; exit}' "$CONFIG_FILE" 2>/dev/null || echo "main")
  else
    BASE_BRANCH="main"
  fi
fi
[ -z "${BASE_BRANCH:-}" ] && BASE_BRANCH="main"
echo "⚙️  Base Branch: ${BASE_BRANCH}"

# ── 중복 실행 방지 (lock + stale 감지) ─────────────────
LOCK_DIR="/tmp/orchestrate.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  # stale lock 감지: PID 파일이 있고 해당 프로세스가 죽어있으면 lock 제거
  if [ -f "$LOCK_DIR/pid" ]; then
    old_pid=$(cat "$LOCK_DIR/pid" 2>/dev/null)
    if [ -n "$old_pid" ] && ! kill -0 "$old_pid" 2>/dev/null; then
      echo "⚠️  이전 orchestrate (PID=${old_pid}) 비정상 종료 감지 → lock 정리"
      rm -rf "$LOCK_DIR"
      mkdir "$LOCK_DIR" 2>/dev/null || { echo "❌ lock 획득 실패"; exit 1; }
    else
      echo "⚠️  orchestrate.sh가 이미 실행 중입니다 (PID=${old_pid}). 중복 실행 방지."
      exit 0
    fi
  else
    echo "⚠️  orchestrate.sh가 이미 실행 중입니다. 중복 실행 방지."
    exit 0
  fi
fi
echo $$ > "$LOCK_DIR/pid"

cleanup_lock() {
  local exit_code=$?
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🛑 Pipeline 종료 (exit=${exit_code})"

  # 비정상 종료(SIGKILL 등)일 때만 워커 강제 종료
  # 정상 Stop은 워커가 알아서 끝나도록 둠
  if [ "$exit_code" -gt 128 ]; then
    echo "  ⚠️ 비정상 종료 감지 → 워커 강제 종료"
    for _tid in "${RUNNING[@]+"${RUNNING[@]}"}"; do
      [ -z "$_tid" ] && continue
      _stop_worker "$_tid"
    done
  fi

  # in_progress 태스크를 pending으로 원복
  for _tid in "${RUNNING[@]+"${RUNNING[@]}"}"; do
    [ -z "$_tid" ] && continue
    local _tf
    _tf=$(find_file "$_tid" 2>/dev/null)
    if [ -n "$_tf" ] && grep -q 'status: in_progress' "$_tf" 2>/dev/null; then
      sed_inplace "s/^status: in_progress/status: stopped/" "$_tf"
      echo "  ⏹️  ${_tid}: in_progress → stopped"
    fi
  done
  rm -rf "$SIGNAL_DIR" "$LOCK_DIR" "$RETRY_DIR"
}
trap cleanup_lock EXIT INT TERM

# ── 사전 검증 ──────────────────────────────────────────

if [ ! -d "$TASK_DIR" ]; then
  echo "❌ 태스크 디렉토리가 없습니다: $TASK_DIR" >&2
  exit 1
fi

# iTerm 모드일 때만 iTerm2 실행 여부 확인
if [ "$WORKER_MODE" = "iterm" ]; then
  if ! osascript -e 'tell application "System Events" to (name of processes) contains "iTerm2"' | grep -q true; then
    echo "❌ iTerm2가 실행 중이지 않습니다. (iterm 모드)" >&2
    echo "   iTerm2를 실행하거나 WORKER_MODE=background 로 전환하세요." >&2
    exit 1
  fi
fi


# ── Memory Guard + Dispatch 제어 ──────────────────────

count_claude_procs() {
  pgrep -f "claude.*--dangerously-skip-permissions" 2>/dev/null | wc -l | tr -d ' '
}

can_dispatch() {
  # Gate 1: OS 레벨 claude 프로세스 hard limit
  local current
  current=$(count_claude_procs)
  if [ "$current" -ge "$MAX_CLAUDE_PROCS" ]; then
    echo "  🛑 claude hard limit (${current}/${MAX_CLAUDE_PROCS}) → 대기"
    return 1
  fi

  # Gate 2: 시스템 메모리 체크 (macOS: memory_pressure / Linux: /proc/meminfo)
  if [[ "$(uname)" == "Darwin" ]]; then
    local level
    level=$(memory_pressure 2>/dev/null | grep -o 'The system is under .*memory pressure' | awk '{print $6}' || echo "normal")
    case "$level" in
      critical|warn*) echo "  🚨 메모리 압박 (${level}) → 대기"; return 1 ;;
    esac
  else
    local avail_mb
    avail_mb=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 9999)
    if [ "${avail_mb}" -lt 512 ]; then
      echo "  🚨 가용 메모리 ${avail_mb}MB < 512MB → 대기"
      return 1
    fi
  fi

  return 0
}

# ── Signal 대기 (fswatch 우선, fallback polling) ─────

wait_for_signal() {
  if command -v fswatch &>/dev/null; then
    fswatch -1 --event Created "$SIGNAL_DIR" --latency 0.5 2>/dev/null &
    local fspid=$!
    # 최대 10초 대기, signal 오면 즉시 깨어남
    local waited=0
    while kill -0 "$fspid" 2>/dev/null && [ "$waited" -lt 10 ]; do
      sleep 1
      waited=$((waited + 1))
      # signal 파일이 이미 있으면 즉시 리턴
      for sf in "$SIGNAL_DIR"/*-task-done "$SIGNAL_DIR"/*-task-failed "$SIGNAL_DIR"/*-review-approved "$SIGNAL_DIR"/*-review-rejected "$SIGNAL_DIR"/*-stopped; do
        [ -f "$sf" ] && kill "$fspid" 2>/dev/null && return 0
      done
    done
    kill "$fspid" 2>/dev/null || true
  else
    sleep 2
  fi
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

# 실행 중인 태스크와 scope가 겹치는지 체크
# 겹치면 1(false), 안 겹치면 0(true) 반환
scope_not_conflicting() {
  local task_id="$1"
  local tf
  tf=$(find_file "$task_id")
  [ -z "$tf" ] && return 0

  local new_scope
  new_scope=$(get_list "$tf" "scope")
  # scope가 없으면 충돌 없음
  [ -z "$new_scope" ] && return 0

  for running_id in "${RUNNING[@]+"${RUNNING[@]}"}"; do
    [ -z "$running_id" ] && continue
    local rtf
    rtf=$(find_file "$running_id")
    [ -z "$rtf" ] && continue

    local running_scope
    running_scope=$(get_list "$rtf" "scope")
    [ -z "$running_scope" ] && continue

    # scope 패턴 겹침 체크
    while IFS= read -r ns; do
      [ -z "$ns" ] && continue
      while IFS= read -r rs; do
        [ -z "$rs" ] && continue
        # 정확히 같거나, 한쪽이 다른 쪽의 상위 경로이면 충돌
        if [ "$ns" = "$rs" ]; then
          echo "  ⚠️  ${task_id}: scope 충돌 (${ns}) ← ${running_id} 실행 중"
          return 1
        fi
        # glob 패턴: src/frontend/** vs src/frontend/src/app/** → 겹침
        # 간단히: 한쪽이 다른쪽으로 시작하면 충돌
        local ns_base="${ns%%/\*\*}"
        local rs_base="${rs%%/\*\*}"
        if [[ "$ns_base" == "$rs_base"* ]] || [[ "$rs_base" == "$ns_base"* ]]; then
          echo "  ⚠️  ${task_id}: scope 충돌 (${ns} ↔ ${rs}) ← ${running_id} 실행 중"
          return 1
        fi
      done <<< "$running_scope"
    done <<< "$new_scope"
  done
  return 0
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
        -m "chore(${tid}): status → stopped (dependency ${failed_id} failed)" || true
      # 재귀: 이 태스크에 의존하는 것도 중단
      stop_dependents "$tid"
    fi
  done <<< "$(get_task_ids)"
}

# ── background 워커 종료 헬퍼 ─────────────────────────

_stop_worker() {
  local task_id="$1"
  local pid_file="/tmp/worker-${task_id}.pid"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file" 2>/dev/null || true)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "  🛑 ${task_id}: 백그라운드 프로세스 종료 (PID=${pid})"
    fi
    rm -f "$pid_file"
  fi
}

# ── 태스크 시작 헬퍼 ──────────────────────────────────

start_task() {
  local task_id="$1"
  local feedback_file="${2:-}"
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
    git -C "$REPO_ROOT" commit --only "$tf" -m "chore(${task_id}): status → in_progress" || true
  fi

  mkdir -p "$REPO_ROOT/output/logs"
  local log_file="$REPO_ROOT/output/logs/${task_id}.log"

  # ── config.json에서 ANTHROPIC_API_KEY 읽기 ──
  local _api_key=""
  if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
    _api_key=$(jq -r '.claudeApiKey // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  elif [ -f "$CONFIG_FILE" ]; then
    _api_key=$(awk -F'"' '/"claudeApiKey"/{print $4; exit}' "$CONFIG_FILE" 2>/dev/null || echo "")
  fi

  # job-task.sh 실행 (단발성 — 1회 실행 후 종료)
  local feedback_arg=""
  [ -n "$feedback_file" ] && [ -f "$feedback_file" ] && feedback_arg="$feedback_file"

  local _env_prefix=""
  [ -n "$_api_key" ] && _env_prefix="ANTHROPIC_API_KEY='${_api_key}' "

  local _job_cmd="${_env_prefix}bash '${REPO_ROOT}/scripts/job-task.sh' '${task_id}' '${SIGNAL_DIR}' '${feedback_arg}'"

  if [ "$WORKER_MODE" = "iterm" ]; then
    # iTerm 탭에서 실행 (로그는 탭에서 직접 확인)
    bash "${REPO_ROOT}/scripts/lib/iterm-run.sh" "🔧 ${task_id}" "${_job_cmd} 2>&1 | tee '${log_file}'; bash '${REPO_ROOT}/scripts/lib/close-iterm-session.sh'"
    echo "  🔄 ${task_id}: iTerm 탭에서 실행 중 (로그: output/logs/${task_id}.log)"
  else
    # 백그라운드 실행
    if [ -n "$_api_key" ]; then
      ANTHROPIC_API_KEY="${_api_key}" nohup bash "${REPO_ROOT}/scripts/job-task.sh" "${task_id}" "${SIGNAL_DIR}" "${feedback_arg}" \
        > "${log_file}" 2>&1 &
    else
      nohup bash "${REPO_ROOT}/scripts/job-task.sh" "${task_id}" "${SIGNAL_DIR}" "${feedback_arg}" \
        > "${log_file}" 2>&1 &
    fi
    local pid=$!
    echo "$pid" > "/tmp/worker-${task_id}.pid"
    echo "  🔄 ${task_id}: job-task 실행 중 (PID=${pid}, 로그: output/logs/${task_id}.log)"
  fi
}

# review job 시작 헬퍼
start_review() {
  local task_id="$1"
  echo "  🔍 ${task_id}: review 시작..."

  local log_file="$REPO_ROOT/output/logs/${task_id}-review.log"

  local _api_key=""
  if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
    _api_key=$(jq -r '.claudeApiKey // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  elif [ -f "$CONFIG_FILE" ]; then
    _api_key=$(awk -F'"' '/"claudeApiKey"/{print $4; exit}' "$CONFIG_FILE" 2>/dev/null || echo "")
  fi

  local _env_prefix=""
  [ -n "$_api_key" ] && _env_prefix="ANTHROPIC_API_KEY='${_api_key}' "

  local _review_cmd="${_env_prefix}bash '${REPO_ROOT}/scripts/job-review.sh' '${task_id}' '${SIGNAL_DIR}'"

  if [ "$WORKER_MODE" = "iterm" ]; then
    bash "${REPO_ROOT}/scripts/lib/iterm-run.sh" "🔍 ${task_id} review" "${_review_cmd} 2>&1 | tee '${log_file}'; bash '${REPO_ROOT}/scripts/lib/close-iterm-session.sh'"
    echo "  🔄 ${task_id}: iTerm 탭에서 review 실행 중"
  else
    if [ -n "$_api_key" ]; then
      ANTHROPIC_API_KEY="${_api_key}" nohup bash "${REPO_ROOT}/scripts/job-review.sh" "${task_id}" "${SIGNAL_DIR}" \
        > "${log_file}" 2>&1 &
    else
      nohup bash "${REPO_ROOT}/scripts/job-review.sh" "${task_id}" "${SIGNAL_DIR}" \
        > "${log_file}" 2>&1 &
    fi
    local pid=$!
    echo "$pid" > "/tmp/worker-${task_id}.pid"
    echo "  🔄 ${task_id}: job-review 실행 중 (PID=${pid})"
  fi
}

# ── Retry 카운트 관리 (파일 기반, bash 3.2 호환) ────────
RETRY_DIR="/tmp/orchestrate-retry"
mkdir -p "$RETRY_DIR"

get_retry_count() {
  local f="$RETRY_DIR/$1"
  if [ -f "$f" ]; then cat "$f"; else echo 0; fi
}
increment_retry() {
  local f="$RETRY_DIR/$1"
  local c=$(get_retry_count "$1")
  echo $((c + 1)) > "$f"
}

# ── Signal 처리 (새 구조: task-done/task-failed/review-approved/review-rejected/stopped) ──

process_signals_for_task() {
  local task_id="$1"

  # 1) 사용자 요청에 의한 중지
  if [ -f "${SIGNAL_DIR}/${task_id}-stopped" ]; then
    echo "  🛑 ${task_id} 중지됨 (사용자 요청)"
    rm -f "${SIGNAL_DIR}/${task_id}-stopped"
    rm -f "/tmp/worker-${task_id}.pid"
    local stopped_tf
    stopped_tf=$(find_file "$task_id")
    if [ -n "$stopped_tf" ]; then
      sed_inplace "s/^status: .*/status: stopped/" "$stopped_tf"
      git -C "$REPO_ROOT" add "$stopped_tf"
      git -C "$REPO_ROOT" commit --only "$stopped_tf" \
        -m "chore(${task_id}): status → stopped (사용자 요청)" || true
    fi
    return 3  # RUNNING에서 제거
  fi

  # 2) task-done → review 시작 (hard limit 체크)
  if [ -f "${SIGNAL_DIR}/${task_id}-task-done" ]; then
    rm -f "/tmp/worker-${task_id}.pid"
    local claude_count
    claude_count=$(count_claude_procs)
    if [ "$claude_count" -ge "$MAX_CLAUDE_PROCS" ]; then
      echo "  ⏸️ ${task_id} task 완료, review 대기 (claude ${claude_count}/${MAX_CLAUDE_PROCS})"
      return 2  # signal 파일은 남겨둠 → 다음 루프에서 재시도
    fi
    echo "  ✅ ${task_id} task 완료 → review 시작"
    rm -f "${SIGNAL_DIR}/${task_id}-task-done"
    start_review "$task_id"
    return 2  # 아직 진행 중 (review 대기)
  fi

  # 3) task-rejected → 거절 (의미없는 태스크)
  if [ -f "${SIGNAL_DIR}/${task_id}-task-rejected" ]; then
    rm -f "${SIGNAL_DIR}/${task_id}-task-rejected"
    rm -f "/tmp/worker-${task_id}.pid"
    local reject_reason=""
    local output_dir
    if [ -d "$REPO_ROOT/.orchestration/output" ]; then
      output_dir="$REPO_ROOT/.orchestration/output"
    else
      output_dir="$REPO_ROOT/output"
    fi
    if [ -f "$output_dir/${task_id}-rejection-reason.txt" ]; then
      reject_reason=$(head -1 "$output_dir/${task_id}-rejection-reason.txt")
    fi
    echo "  🚫 ${task_id} 거절됨: ${reject_reason}"
    _mark_task_rejected "$task_id" "$reject_reason"
    return 1
  fi

  # 4) task-failed → 즉시 실패
  if [ -f "${SIGNAL_DIR}/${task_id}-task-failed" ]; then
    echo "  ❌ ${task_id} task 실행 실패"
    rm -f "${SIGNAL_DIR}/${task_id}-task-failed"
    rm -f "/tmp/worker-${task_id}.pid"
    _mark_task_failed "$task_id" "task 실행 실패"
    return 1
  fi

  # 4) review-approved → 머지 + done
  if [ -f "${SIGNAL_DIR}/${task_id}-review-approved" ]; then
    echo "  ✅ ${task_id} review 승인 → 머지"
    rm -f "${SIGNAL_DIR}/${task_id}-review-approved"
    rm -f "/tmp/worker-${task_id}.pid"
    _merge_and_done "$task_id"
    return $?
  fi

  # 5) review-rejected → retry 또는 failed (hard limit 체크)
  if [ -f "${SIGNAL_DIR}/${task_id}-review-rejected" ]; then
    rm -f "/tmp/worker-${task_id}.pid"
    local rc
    rc=$(get_retry_count "$task_id")
    if [ "$rc" -lt "$MAX_REVIEW_RETRY" ]; then
      local claude_count
      claude_count=$(count_claude_procs)
      if [ "$claude_count" -ge "$MAX_CLAUDE_PROCS" ]; then
        echo "  ⏸️ ${task_id} retry 대기 (claude ${claude_count}/${MAX_CLAUDE_PROCS})"
        return 2  # signal 파일은 남겨둠 → 다음 루프에서 재시도
      fi
      rm -f "${SIGNAL_DIR}/${task_id}-review-rejected"
      increment_retry "$task_id"
      echo "  🔄 ${task_id} review 수정요청 → retry ($((rc + 1))/${MAX_REVIEW_RETRY})"
      local output_dir
      if [ -d "$REPO_ROOT/.orchestration/output" ]; then
        output_dir="$REPO_ROOT/.orchestration/output"
      else
        output_dir="$REPO_ROOT/output"
      fi
      local feedback_file="$output_dir/${task_id}-review-feedback.txt"
      start_task "$task_id" "$feedback_file"
      return 2  # 아직 진행 중 (retry)
    else
      echo "  ❌ ${task_id} retry 상한 초과 (${MAX_REVIEW_RETRY})"
      _mark_task_failed "$task_id" "review retry 상한 초과"
      return 1
    fi
  fi

  return 2  # 아직 진행 중
}

# ── 머지 + done 처리 ─────────────────────────────────────
_merge_and_done() {
  local task_id="$1"
  local local_task_file
  local_task_file=$(find_file "$task_id")

  if [ -n "$local_task_file" ]; then
    sed_inplace "s/^status: .*/status: done/" "$local_task_file"
  fi

  local wt_path
  wt_path=$(get_worktree "$task_id")
  local branch
  branch=$(get_branch "$task_id")

  if [ -n "$branch" ]; then
    if git -C "$REPO_ROOT" log --oneline "${BASE_BRANCH}..$branch" 2>/dev/null | grep -q .; then
      echo "  🔀 ${task_id}: $branch → ${BASE_BRANCH} 머지"
      if ! git -C "$REPO_ROOT" merge "$branch" --no-ff --no-edit; then
        if ! resolve_merge_conflict "$REPO_ROOT" "$task_id" "$branch" "$BASE_BRANCH"; then
          sed_inplace "s/^status: .*/status: failed/" "$local_task_file"
          git -C "$REPO_ROOT" add "$local_task_file"
          git -C "$REPO_ROOT" commit --only "$local_task_file" \
            -m "chore(${task_id}): status → failed (merge conflict)" || true
          git -C "$REPO_ROOT" branch -d "$branch" 2>/dev/null || true
          stop_dependents "$task_id"
          return 1
        fi
      fi
    fi
    git -C "$REPO_ROOT" branch -d "$branch" 2>/dev/null || true
  fi

  if [ -d "$wt_path" ]; then
    git -C "$REPO_ROOT" worktree remove "$wt_path" --force 2>/dev/null || true
  fi

  if [ -n "$local_task_file" ]; then
    git -C "$REPO_ROOT" add "$local_task_file"
    git -C "$REPO_ROOT" commit --only "$local_task_file" -m "chore(${task_id}): status → done" || true
  fi

  local task_title
  task_title=$(get_field "$local_task_file" "title")
  post_notice "info" \
    "${task_id} 완료" \
    "**${task_id}:** ${task_title}

태스크가 성공적으로 완료되어 ${BASE_BRANCH}에 머지되었습니다."
  return 0
}

# ── 실패 처리 ─────────────────────────────────────────────
_mark_task_failed() {
  local task_id="$1"
  local reason="$2"

  local tf
  tf=$(find_file "$task_id")
  if [ -n "$tf" ]; then
    sed_inplace "s/^status: .*/status: failed/" "$tf"
    git -C "$REPO_ROOT" add "$tf"
    git -C "$REPO_ROOT" commit --only "$tf" -m "chore(${task_id}): status → failed (${reason})" || true
  fi

  local wt_path
  wt_path=$(get_worktree "$task_id")
  if [ -d "$wt_path" ]; then
    git -C "$REPO_ROOT" worktree remove "$wt_path" --force 2>/dev/null || true
  fi
  local branch
  branch=$(get_branch "$task_id")
  if [ -n "$branch" ]; then
    git -C "$REPO_ROOT" branch -D "$branch" 2>/dev/null || true
  fi

  local title
  title=$(get_field "$tf" "title")
  post_notice "error" \
    "${task_id} 실패" \
    "**${task_id}:** ${title}\n\n${reason}"

  stop_dependents "$task_id"
}

_mark_task_rejected() {
  local task_id="$1"
  local reason="$2"

  local tf
  tf=$(find_file "$task_id")
  if [ -n "$tf" ]; then
    sed_inplace "s/^status: .*/status: rejected/" "$tf"
    git -C "$REPO_ROOT" add "$tf"
    git -C "$REPO_ROOT" commit --only "$tf" -m "chore(${task_id}): status → rejected (${reason})" || true
  fi

  # worktree + 브랜치 정리
  local wt_path
  wt_path=$(get_worktree "$task_id")
  if [ -d "$wt_path" ]; then
    git -C "$REPO_ROOT" worktree remove "$wt_path" --force 2>/dev/null || true
  fi
  local branch
  branch=$(get_branch "$task_id")
  if [ -n "$branch" ]; then
    git -C "$REPO_ROOT" branch -D "$branch" 2>/dev/null || true
  fi

  local title
  title=$(get_field "$tf" "title")
  post_notice "warning" \
    "${task_id} 거절" \
    "**${task_id}:** ${title}\n\n${reason}"
}

# ── 메인 파이프라인 (슬롯 기반) ──────────────────────

echo "🚀 Pipeline 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RUNNING=()   # 현재 실행 중인 태스크 ID 목록
FAILED_COUNT=0

while true; do
  # ── config.json에서 maxParallel 핫 리로드 ──
  if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
    _new_task=$(jq -r '.maxParallel.task // 2' "$CONFIG_FILE" 2>/dev/null || echo "")
    _new_review=$(jq -r '.maxParallel.review // 2' "$CONFIG_FILE" 2>/dev/null || echo "")
    if [ -n "$_new_task" ] && [ "$_new_task" != "$MAX_PARALLEL_TASK" ]; then
      echo "  ⚙️  MAX_PARALLEL_TASK 변경: ${MAX_PARALLEL_TASK} → ${_new_task}"
      MAX_PARALLEL_TASK="$_new_task"
    fi
    if [ -n "$_new_review" ] && [ "$_new_review" != "$MAX_PARALLEL_REVIEW" ]; then
      echo "  ⚙️  MAX_PARALLEL_REVIEW 변경: ${MAX_PARALLEL_REVIEW} → ${_new_review}"
      MAX_PARALLEL_REVIEW="$_new_review"
    fi
    MAX_CLAUDE_PROCS=$(( MAX_PARALLEL_TASK + MAX_PARALLEL_REVIEW ))
  fi

  # ── 실행 중인 태스크 완료 여부 체크 (슬롯 투입 전에 먼저 갱신) ──
  if [ "${#RUNNING[@]}" -gt 0 ]; then
    NEW_RUNNING=()
    for task_id in "${RUNNING[@]}"; do
      [ -z "$task_id" ] && continue
      rc=0
      process_signals_for_task "$task_id" || rc=$?
      if [ "$rc" -eq 2 ]; then
        # 아직 진행 중
        NEW_RUNNING+=("$task_id")
      elif [ "$rc" -eq 1 ]; then
        # 실패
        FAILED_COUNT=$((FAILED_COUNT + 1))
      elif [ "$rc" -eq 3 ]; then
        # 사용자 요청에 의한 중지 → 실패 카운트 미증가, RUNNING에서 제거
        echo "  ⏹️  ${task_id}: 중지됨 (사용자 요청)"
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
  echo "  🔍 슬롯 체크: RUNNING=${#RUNNING[@]}/${MAX_PARALLEL_TASK}, QUEUE=${#QUEUE[@]}"
  while [ "${#RUNNING[@]}" -lt "$MAX_PARALLEL_TASK" ] && [ "$qi" -lt "${#QUEUE[@]}" ]; do
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

    # scope 겹침 체크: 실행 중인 태스크와 scope가 겹치면 스킵
    if ! scope_not_conflicting "$next_task"; then
      continue
    fi

    # memory guard + dispatch 간격 체크
    if ! can_dispatch; then
      break  # 리소스 부족 → 이번 루프에서 더 이상 투입 안 함
    fi

    start_task "$next_task"
    RUNNING+=("$next_task")
    echo "  📊 슬롯: ${#RUNNING[@]}/${MAX_PARALLEL_TASK} (대기: $((${#QUEUE[@]} - qi)))"
  done

  # fswatch 기반 이벤트 대기 (또는 fallback polling 2초)
  wait_for_signal
done
