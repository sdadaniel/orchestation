#!/bin/bash
set -euo pipefail

# Usage: ./scripts/orchestrate.sh
# 의존 관계에 따라 태스크를 배치로 수집하고,
# 병렬 태스크는 각각 별도 iTerm 패널에서 실행

PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
REPO_ROOT="$PROJECT_ROOT"  # backward compat alias
export PACKAGE_DIR PROJECT_ROOT

source "$PACKAGE_DIR/scripts/lib/common.sh"
source "$PACKAGE_DIR/scripts/lib/sed-inplace.sh"
source "$PACKAGE_DIR/scripts/lib/merge-resolver.sh"

# ── SQLite DB (dual-write: 파일 + DB) ──
DB_FILE="${PROJECT_ROOT:-.}/.orchestration/orchestration.db"

# SQLite 헬퍼: status 업데이트
_db_set_status() {
  local task_id="$1" new_status="$2"
  [ ! -f "$DB_FILE" ] && return 0
  sqlite3 "$DB_FILE" "UPDATE tasks SET status='${new_status}', updated=datetime('now','localtime') WHERE id='${task_id}';" 2>/dev/null || true
}

# SQLite 헬퍼: 이벤트 삽입
_db_insert_event() {
  local task_id="$1" event_type="$2" to_status="${3:-}"
  [ ! -f "$DB_FILE" ] && return 0
  if [ -n "$to_status" ]; then
    sqlite3 "$DB_FILE" "INSERT INTO task_events(task_id,event_type,to_status) VALUES('${task_id}','${event_type}','${to_status}');" 2>/dev/null || true
  else
    sqlite3 "$DB_FILE" "INSERT INTO task_events(task_id,event_type) VALUES('${task_id}','${event_type}');" 2>/dev/null || true
  fi
}

# SQLite 헬퍼: token_usage 삽입
_db_insert_token_usage() {
  local task_id="$1" phase="$2" model="$3"
  local input_tokens="$4" output_tokens="$5" cache_create="$6" cache_read="$7"
  local cost="$8" duration_ms="$9"
  [ ! -f "$DB_FILE" ] && return 0
  sqlite3 "$DB_FILE" "INSERT INTO token_usage(task_id,phase,model,input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens,cost_usd,duration_ms) VALUES('${task_id}','${phase}','${model}',${input_tokens},${output_tokens},${cache_create},${cache_read},${cost},${duration_ms});" 2>/dev/null || true
}
# .orchestration/tasks를 우선, 없으면 docs/task fallback
if [ -d "$PROJECT_ROOT/.orchestration/tasks" ]; then
  TASK_DIR="$PROJECT_ROOT/.orchestration/tasks"
else
  TASK_DIR="$PROJECT_ROOT/docs/task"
fi
REQ_DIR="$PROJECT_ROOT/docs/requests"

# ── config.json 경로 결정 (.orchestration/ 우선, 루트 fallback) ──
if [ -f "$REPO_ROOT/.orchestration/config.json" ]; then
  CONFIG_FILE="$REPO_ROOT/.orchestration/config.json"
elif [ -f "$REPO_ROOT/config.json" ]; then
  CONFIG_FILE="$REPO_ROOT/config.json"
else
  CONFIG_FILE="$REPO_ROOT/config.json"
fi

# ── 실행 설정 (환경변수 > config.json > 기본값) ──
# config.json에서 초기값 로딩 (핫 리로드는 메인 루프에서 별도 처리)
if [ -z "${MAX_REVIEW_RETRY:-}" ] && [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
  MAX_REVIEW_RETRY=$(jq -r '.maxReviewRetry // 3' "$CONFIG_FILE" 2>/dev/null || echo "3")
else
  MAX_REVIEW_RETRY="${MAX_REVIEW_RETRY:-3}"
fi
MAX_TASK_COST="${MAX_TASK_COST:-5.0}"  # 태스크당 누적 비용 상한 ($)
if [ -z "${MAX_PARALLEL_TASK:-}" ] && [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
  MAX_PARALLEL_TASK=$(jq -r '.maxParallel.task // 2' "$CONFIG_FILE" 2>/dev/null || echo "2")
else
  MAX_PARALLEL_TASK="${MAX_PARALLEL_TASK:-2}"
fi
if [ -z "${MAX_PARALLEL_REVIEW:-}" ] && [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
  MAX_PARALLEL_REVIEW=$(jq -r '.maxParallel.review // 2' "$CONFIG_FILE" 2>/dev/null || echo "2")
else
  MAX_PARALLEL_REVIEW="${MAX_PARALLEL_REVIEW:-2}"
fi
MAX_CLAUDE_PROCS=$(( MAX_PARALLEL_TASK + MAX_PARALLEL_REVIEW ))
echo "⚙️  Parallel: task=${MAX_PARALLEL_TASK}, review=${MAX_PARALLEL_REVIEW}, max_procs=${MAX_CLAUDE_PROCS}"
echo "⚙️  Review Retry: ${MAX_REVIEW_RETRY}"
SIGNAL_DIR="$REPO_ROOT/.orchestration/signals"
mkdir -p "$SIGNAL_DIR"
LAST_DISPATCH_TIME=0
# 이전 실행의 남은 시그널 정리하지 않음 — 재시작 시 이전 done/failed 시그널 처리 가능

# ── srcPaths 읽기 (config.json → 기본값 "src/") ──
if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
  SRC_PATHS=$(jq -r '.srcPaths // ["src/"] | join(",")' "$CONFIG_FILE" 2>/dev/null || echo "src/")
else
  SRC_PATHS="src/"
fi
export SRC_PATHS
echo "⚙️  Source Paths: ${SRC_PATHS}"

# ── workerMode 결정 (환경변수 > config.json > 기본값 background) ──
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

# ── 프로젝트별 임시 디렉토리 격리 (동시 실행 지원) ──────────────
# PROJECT_ROOT 경로의 해시를 prefix로 사용하여 /tmp/ 경로 충돌 방지
_proj_hash=$(echo "$PROJECT_ROOT" | cksum | awk '{print $1}')
TMP_PREFIX="/tmp/orchestrate-${_proj_hash}"
mkdir -p "$TMP_PREFIX"
echo "⚙️  Tmp prefix: ${TMP_PREFIX} (project: ${PROJECT_ROOT})"

# ── 중복 실행 방지 (같은 프로젝트 내에서만) ─────────────────
# PID 파일 기반으로 같은 프로젝트의 기존 인스턴스만 확인
_existing_pid_file="${TMP_PREFIX}/orchestrate.pid"
if [ -f "$_existing_pid_file" ]; then
  _existing_pid=$(cat "$_existing_pid_file" 2>/dev/null || echo "")
  if [ -n "$_existing_pid" ] && kill -0 "$_existing_pid" 2>/dev/null; then
    echo "⚠️  같은 프로젝트의 기존 orchestrate.sh 종료 (PID $_existing_pid)"
    kill "$_existing_pid" 2>/dev/null || true
    sleep 1
  fi
fi
echo $$ > "$_existing_pid_file"

# 2단계: lock 획득 (PID 기반 stale lock 검증)
LOCK_DIR="${TMP_PREFIX}/lock"
if [ -d "$LOCK_DIR" ]; then
  _lock_holder=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")
  if [ -n "$_lock_holder" ] && kill -0 "$_lock_holder" 2>/dev/null; then
    # lock holder가 살아있는데 pgrep으로 안 잡힌 경우 (symlink 호출 등)
    echo "❌ lock 보유 프로세스 생존 중 (PID $_lock_holder) — 종료"
    exit 1
  fi
  # holder가 죽었으면 stale lock 정리
  rm -rf "$LOCK_DIR" 2>/dev/null
fi
mkdir "$LOCK_DIR" 2>/dev/null || { echo "❌ lock 획득 실패"; exit 1; }
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
      _running_unmark "$_tid"
    done
  fi

  # in_progress 태스크를 pending으로 원복
  for _tid in "${RUNNING[@]+"${RUNNING[@]}"}"; do
    [ -z "$_tid" ] && continue
    local _tf
    _tf=$(find_file "$_tid" 2>/dev/null)
    if [ -n "$_tf" ] && grep -q 'status: in_progress' "$_tf" 2>/dev/null; then
      _set_status "$_tf" "stopped"
      _db_set_status "$_tid" "stopped"
      _db_insert_event "$_tid" "status_change" "stopped"
      echo "  ⏹️  ${_tid}: in_progress → stopped"
    fi
  done
  rm -f "$SIGNAL_DIR"/* 2>/dev/null || true   # 디렉토리 유지, 내부 파일만 정리
  rm -rf "$LOCK_DIR" "$RETRY_DIR"
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
    if [ "${avail_mb}" -lt 2048 ]; then
      echo "  🚨 가용 메모리 ${avail_mb}MB < 2048MB → 대기"
      return 1
    fi
  fi

  return 0
}

# ── Signal 대기 (fswatch 우선, fallback polling) ─────

wait_for_signal() {
  # 먼저 이미 도착한 시그널이 있는지 즉시 체크
  for sf in "$SIGNAL_DIR"/*-task-done "$SIGNAL_DIR"/*-task-failed "$SIGNAL_DIR"/*-review-approved "$SIGNAL_DIR"/*-review-rejected "$SIGNAL_DIR"/*-stopped; do
    [ -f "$sf" ] && return 0
  done

  if command -v fswatch &>/dev/null; then
    # fswatch 이벤트를 직접 수신 (polling 루프 제거)
    fswatch -1 --event Created --event Updated "$SIGNAL_DIR" --latency 0.3 2>/dev/null &
    local fspid=$!
    # fswatch가 이벤트를 감지하거나 10초 경과 중 먼저 발생하는 것
    local waited=0
    while kill -0 "$fspid" 2>/dev/null && [ "$waited" -lt 10 ]; do
      sleep 0.3
      waited=$((waited + 1))
      # 빠른 시그널 체크 (0.3초 간격)
      for sf in "$SIGNAL_DIR"/*-task-done "$SIGNAL_DIR"/*-task-failed "$SIGNAL_DIR"/*-review-approved "$SIGNAL_DIR"/*-review-rejected "$SIGNAL_DIR"/*-stopped; do
        [ -f "$sf" ] && kill "$fspid" 2>/dev/null && return 0
      done
    done
    kill "$fspid" 2>/dev/null || true
  else
    sleep 1
  fi
}

# ── 헬퍼 함수 ─────────────────────────────────────────

# status 변경 + updated 타임스탬프 갱신
_set_status() {
  local file="$1" new_status="$2"
  local today
  today=$(date '+%Y-%m-%d %H:%M')
  sed_inplace "s/^status: .*/status: ${new_status}/" "$file"
  sed_inplace "s/^updated: .*/updated: ${today}/" "$file"
}

get_output_dir() {
  if [ -d "$REPO_ROOT/.orchestration/output" ]; then
    echo "$REPO_ROOT/.orchestration/output"
  else
    echo "$REPO_ROOT/output"
  fi
}

read_api_key() {
  local _api_key=""
  if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
    _api_key=$(jq -r '.claudeApiKey // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  elif [ -f "$CONFIG_FILE" ]; then
    _api_key=$(awk -F'"' '/"claudeApiKey"/{print $4; exit}' "$CONFIG_FILE" 2>/dev/null || echo "")
  fi
  echo "$_api_key"
}

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

# ── 태스크 파일 캐시 (find 호출 최소화) ──────────────────────
# bash 3.x: declare -A 불가 → 파일 기반 캐시
_FIND_CACHE_DIR="${TMP_PREFIX}/filecache"
mkdir -p "$_FIND_CACHE_DIR" 2>/dev/null || true
_FIND_CACHE_EPOCH=0

_rebuild_find_cache() {
  rm -f "$_FIND_CACHE_DIR"/* 2>/dev/null || true
  local f id
  for f in "$TASK_DIR"/*.md "$REQ_DIR"/*.md; do
    [ -f "$f" ] || continue
    id=$(basename "$f" | grep -oE '^(TASK|REQ)-[0-9]+' || true)
    [ -n "$id" ] && echo "$f" > "$_FIND_CACHE_DIR/$id"
  done
  _FIND_CACHE_EPOCH=$(date +%s)
}

# 60초마다 캐시 갱신
_maybe_refresh_cache() {
  local now
  now=$(date +%s)
  if [ $((now - _FIND_CACHE_EPOCH)) -gt 60 ]; then
    _rebuild_find_cache
  fi
}

# docs/task/ 또는 docs/requests/ 에서 파일 찾기 (캐시 우선)
find_file() {
  local id="$1"
  _maybe_refresh_cache
  if [ -f "$_FIND_CACHE_DIR/$id" ]; then
    cat "$_FIND_CACHE_DIR/$id"
    return
  fi
  # 캐시 미스 → 직접 찾고 캐시에 저장
  local f=""
  f=$(find "$TASK_DIR" -name "${id}-*.md" 2>/dev/null | head -1)
  if [ -z "$f" ]; then
    f=$(find "$REQ_DIR" -name "${id}-*.md" 2>/dev/null | head -1)
  fi
  [ -n "$f" ] && echo "$f" > "$_FIND_CACHE_DIR/$id"
  echo "$f"
}

# 초기 캐시 구축
_rebuild_find_cache

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
      _set_status "$tf" "stopped"
      _db_set_status "$tid" "stopped"
      _db_insert_event "$tid" "status_change" "stopped"
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
  local pid_file="${TMP_PREFIX}/worker-${task_id}.pid"
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

# ── crash log 기록 헬퍼 ──────────────────────────────────
# 사용: _write_crashlog <task_id> <reason> [pid]
# output/logs/<task_id>-crash-<timestamp>.log 에 진단 정보 기록
_write_crashlog() {
  local task_id="$1"
  local reason="$2"
  local dead_pid="${3:-}"
  local crash_dir="$REPO_ROOT/output/logs"
  mkdir -p "$crash_dir"
  local ts
  ts=$(date '+%Y%m%d-%H%M%S')
  local crashfile="${crash_dir}/${task_id}-crash-${ts}.log"
  local task_log="${crash_dir}/${task_id}.log"

  {
    echo "═══════════════════════════════════════════════════"
    echo "CRASH LOG: ${task_id}"
    echo "═══════════════════════════════════════════════════"
    echo "시각:    $(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo "원인:    ${reason}"
    [ -n "$dead_pid" ] && echo "PID:     ${dead_pid}"
    echo ""

    # 태스크 파일 frontmatter
    echo "── 태스크 정보 ──"
    local _tf
    _tf=$(find_file "$task_id" 2>/dev/null || true)
    if [ -n "$_tf" ] && [ -f "$_tf" ]; then
      head -30 "$_tf" 2>/dev/null || echo "(읽기 실패)"
    else
      echo "(태스크 파일 없음)"
    fi
    echo ""

    # PID 파일 상태
    echo "── PID 파일 ──"
    local _pf="${TMP_PREFIX}/worker-${task_id}.pid"
    if [ -f "$_pf" ]; then
      echo "파일: $_pf → $(cat "$_pf" 2>/dev/null || echo '(읽기 실패)')"
    else
      echo "파일 없음: $_pf"
    fi
    echo ""

    # 시그널 파일 상태
    echo "── 시그널 파일 ──"
    local _found_sig=false
    for _sf in "${SIGNAL_DIR}/${task_id}"-*; do
      [ -e "$_sf" ] && { echo "  $(basename "$_sf")"; _found_sig=true; }
    done
    $_found_sig || echo "  (없음)"
    echo ""

    # 시작 타임스탬프
    echo "── 시작 시각 ──"
    local _startfile="${SIGNAL_DIR}/${task_id}-start"
    if [ -f "$_startfile" ]; then
      local _st
      _st=$(cat "$_startfile" 2>/dev/null || echo "0")
      local _now
      _now=$(date +%s)
      echo "started_at: $_st ($(( _now - _st ))초 전)"
    else
      echo "(start 파일 없음)"
    fi
    echo ""

    # 프로세스 트리 (dead_pid 주변)
    if [ -n "$dead_pid" ]; then
      echo "── 프로세스 상태 ──"
      if kill -0 "$dead_pid" 2>/dev/null; then
        echo "PID $dead_pid: 살아있음 (예상 밖)"
        ps -p "$dead_pid" -o pid,ppid,stat,etime,command 2>/dev/null || true
      else
        echo "PID $dead_pid: 죽음 확인"
      fi
      echo ""
    fi

    # orchestrate.sh 관련 프로세스 현황
    echo "── 현재 워커 프로세스 ──"
    ps aux | grep -E "job-task\.sh|job-review\.sh|claude" | grep -v grep || echo "  (관련 프로세스 없음)"
    echo ""

    # 태스크 로그 마지막 50줄
    echo "── 태스크 로그 (마지막 50줄) ──"
    if [ -f "$task_log" ]; then
      tail -50 "$task_log" 2>/dev/null || echo "(읽기 실패)"
    else
      echo "(로그 파일 없음: $task_log)"
    fi
    echo ""
    echo "═══════════════════════════════════════════════════"
  } > "$crashfile" 2>&1

  echo "  📋 crash log 저장: output/logs/$(basename "$crashfile")"
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
    _set_status "$tf" "in_progress"
    _db_set_status "$task_id" "in_progress"
    _db_insert_event "$task_id" "status_change" "in_progress"
    git -C "$REPO_ROOT" add "$tf"
    # commit은 메인 루프 끝에서 배치로 처리
  fi

  mkdir -p "$REPO_ROOT/output/logs"
  local log_file="$REPO_ROOT/output/logs/${task_id}.log"

  # ── config.json에서 ANTHROPIC_API_KEY 읽기 ──
  local _api_key=""
  _api_key=$(read_api_key)

  # job-task.sh 실행 (단발성 — 1회 실행 후 종료)
  local feedback_arg=""
  [ -n "$feedback_file" ] && [ -f "$feedback_file" ] && feedback_arg="$feedback_file"

  local _env_prefix=""
  [ -n "$_api_key" ] && _env_prefix="ANTHROPIC_API_KEY='${_api_key}' "

  local _job_cmd="${_env_prefix}bash '${PACKAGE_DIR}/scripts/job-task.sh' '${task_id}' '${SIGNAL_DIR}' '${feedback_arg}'"

  if [ "$WORKER_MODE" = "iterm" ]; then
    # iTerm 탭에서 실행 — PID를 기록하여 health check가 즉시 kill하지 않도록 함
    # iTerm 탭 프로세스의 PID를 파일에 기록하는 래퍼 추가
    local _iterm_cmd="echo \$\$ > /tmp/worker-${task_id}.pid; ${_job_cmd} 2>&1 | tee '${log_file}'; rm -f /tmp/worker-${task_id}.pid; bash '${PACKAGE_DIR}/scripts/lib/close-iterm-session.sh'"
    bash "${PACKAGE_DIR}/scripts/lib/iterm-run.sh" "🔧 ${task_id}" "$_iterm_cmd"
    echo "  🔄 ${task_id}: iTerm 탭에서 실행 중 (로그: output/logs/${task_id}.log)"
  else
    # 백그라운드 실행
    if [ -n "$_api_key" ]; then
      ANTHROPIC_API_KEY="${_api_key}" nohup bash "${PACKAGE_DIR}/scripts/job-task.sh" "${task_id}" "${SIGNAL_DIR}" "${feedback_arg}" \
        > "${log_file}" 2>&1 &
    else
      nohup bash "${PACKAGE_DIR}/scripts/job-task.sh" "${task_id}" "${SIGNAL_DIR}" "${feedback_arg}" \
        > "${log_file}" 2>&1 &
    fi
    local pid=$!
    echo "$pid" > "${TMP_PREFIX}/worker-${task_id}.pid"
    echo "  🔄 ${task_id}: job-task 실행 중 (PID=${pid}, 로그: output/logs/${task_id}.log)"

    # ── dispatch 후 프로세스 시작 검증 ──
    sleep 0.3
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "  ❌ ${task_id}: job-task.sh 시작 실패 (PID $pid 즉시 종료) → pending 원복"
      _write_crashlog "$task_id" "dispatch 직후 프로세스 사망 (2초 이내 종료)" "$pid"
      rm -f "${TMP_PREFIX}/worker-${task_id}.pid"
      if [ -n "$tf" ]; then
        _set_status "$tf" "pending"
        _db_set_status "$task_id" "pending"
        _db_insert_event "$task_id" "status_change" "pending"
        git -C "$REPO_ROOT" add "$tf"
        # commit은 메인 루프 끝에서 배치로 처리
      fi
      return 1
    fi
  fi
}

# review job 시작 헬퍼
start_review() {
  local task_id="$1"
  echo "  🔍 ${task_id}: review 시작..."

  local log_file="$REPO_ROOT/output/logs/${task_id}-review.log"

  local _api_key=""
  _api_key=$(read_api_key)

  local _env_prefix=""
  [ -n "$_api_key" ] && _env_prefix="ANTHROPIC_API_KEY='${_api_key}' "

  local _review_cmd="${_env_prefix}bash '${PACKAGE_DIR}/scripts/job-review.sh' '${task_id}' '${SIGNAL_DIR}'"

  if [ "$WORKER_MODE" = "iterm" ]; then
    local _iterm_review_cmd="echo \$\$ > /tmp/worker-${task_id}.pid; ${_review_cmd} 2>&1 | tee '${log_file}'; rm -f /tmp/worker-${task_id}.pid; bash '${PACKAGE_DIR}/scripts/lib/close-iterm-session.sh'"
    bash "${PACKAGE_DIR}/scripts/lib/iterm-run.sh" "🔍 ${task_id} review" "$_iterm_review_cmd"
    echo "  🔄 ${task_id}: iTerm 탭에서 review 실행 중"
  else
    if [ -n "$_api_key" ]; then
      ANTHROPIC_API_KEY="${_api_key}" nohup bash "${PACKAGE_DIR}/scripts/job-review.sh" "${task_id}" "${SIGNAL_DIR}" \
        > "${log_file}" 2>&1 &
    else
      nohup bash "${PACKAGE_DIR}/scripts/job-review.sh" "${task_id}" "${SIGNAL_DIR}" \
        > "${log_file}" 2>&1 &
    fi
    local pid=$!
    echo "$pid" > "${TMP_PREFIX}/worker-${task_id}.pid"
    echo "  🔄 ${task_id}: job-review 실행 중 (PID=${pid})"
  fi
}

# ── Retry 카운트 관리 (파일 기반, bash 3.2 호환) ────────
RETRY_DIR="${TMP_PREFIX}/retry"
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
    rm -f "${TMP_PREFIX}/worker-${task_id}.pid"
    local stopped_tf
    stopped_tf=$(find_file "$task_id")
    if [ -n "$stopped_tf" ]; then
      _set_status "$stopped_tf" "stopped"
      _db_set_status "$task_id" "stopped"
      _db_insert_event "$task_id" "status_change" "stopped"
      git -C "$REPO_ROOT" add "$stopped_tf"
      # commit은 메인 루프 끝에서 배치로 처리
    fi
    return 3  # RUNNING에서 제거
  fi

  # 2) task-done → review 시작 또는 스킵
  if [ -f "${SIGNAL_DIR}/${task_id}-task-done" ]; then
    rm -f "${TMP_PREFIX}/worker-${task_id}.pid"
    rm -f "${SIGNAL_DIR}/${task_id}-task-done"

    # review 스킵 판단: role 기반
    local task_file_for_review
    task_file_for_review=$(find_file "$task_id")
    local task_role=""
    [ -n "$task_file_for_review" ] && task_role=$(get_field "$task_file_for_review" "role")

    if should_skip_review "$task_role"; then
      echo "  ✅ ${task_id} task 완료 → review 스킵 (role: ${task_role}) → 바로 머지"
      _merge_and_done "$task_id"
      return $?
    fi

    local claude_count
    claude_count=$(count_claude_procs)
    if [ "$claude_count" -ge "$MAX_CLAUDE_PROCS" ]; then
      # signal 파일 재생성 → 다음 루프에서 재시도
      signal_create "$SIGNAL_DIR" "$task_id" "task-done"
      echo "  ⏸️ ${task_id} task 완료, review 대기 (claude ${claude_count}/${MAX_CLAUDE_PROCS})"
      return 2
    fi
    echo "  ✅ ${task_id} task 완료 → review 시작"
    start_review "$task_id"
    return 2  # 아직 진행 중 (review 대기)
  fi

  # 3) task-rejected → 거절 (의미없는 태스크)
  if [ -f "${SIGNAL_DIR}/${task_id}-task-rejected" ]; then
    rm -f "${SIGNAL_DIR}/${task_id}-task-rejected"
    rm -f "${TMP_PREFIX}/worker-${task_id}.pid"
    local reject_reason=""
    local output_dir
    output_dir=$(get_output_dir)
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
    rm -f "${TMP_PREFIX}/worker-${task_id}.pid"
    _mark_task_failed "$task_id" "task 실행 실패"
    return 1
  fi

  # 4) review-approved → 머지 + done
  if [ -f "${SIGNAL_DIR}/${task_id}-review-approved" ]; then
    echo "  ✅ ${task_id} review 승인 → 머지"
    rm -f "${SIGNAL_DIR}/${task_id}-review-approved"
    rm -f "${TMP_PREFIX}/worker-${task_id}.pid"
    _db_insert_event "$task_id" "review_approved" "done"
    _merge_and_done "$task_id"
    return $?
  fi

  # 5) review-rejected → retry 또는 failed (hard limit + cost circuit breaker)
  if [ -f "${SIGNAL_DIR}/${task_id}-review-rejected" ]; then
    rm -f "${TMP_PREFIX}/worker-${task_id}.pid"

    # ── circuit breaker: 태스크 누적 비용 체크 ──
    local task_total_cost=0
    local output_dir_cb
    output_dir_cb=$(get_output_dir)
    local token_log_cb="$output_dir_cb/token-usage.log"
    if [ -f "$token_log_cb" ]; then
      task_total_cost=$(grep "${task_id}" "$token_log_cb" | grep -oE 'cost=\$[0-9.]+' | sed 's/cost=\$//' | awk '{s+=$1} END {printf "%.2f", s+0}')
    fi
    if [ -n "$task_total_cost" ] && command -v bc &>/dev/null; then
      if [ "$(echo "$task_total_cost > $MAX_TASK_COST" | bc -l 2>/dev/null)" = "1" ]; then
        echo "  🚨 ${task_id} 비용 상한 초과 (\$${task_total_cost} > \$${MAX_TASK_COST}) → failed 처리"
        rm -f "${SIGNAL_DIR}/${task_id}-review-rejected"
        _db_insert_event "$task_id" "circuit_breaker" "failed"
        _mark_task_failed "$task_id" "비용 상한 초과 (\$${task_total_cost})"
        return 1
      fi
    fi

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
      _db_insert_event "$task_id" "review_rejected" "in_progress"
      echo "  🔄 ${task_id} review 수정요청 → retry ($((rc + 1))/${MAX_REVIEW_RETRY})"
      local output_dir
      output_dir=$(get_output_dir)
      local feedback_file="$output_dir/${task_id}-review-feedback.txt"
      start_task "$task_id" "$feedback_file"
      return 2  # 아직 진행 중 (retry)
    else
      echo "  ❌ ${task_id} retry 상한 초과 (${MAX_REVIEW_RETRY})"
      _db_insert_event "$task_id" "retry_limit_exceeded" "failed"
      _mark_task_failed "$task_id" "review retry 상한 초과"
      return 1
    fi
  fi

  # ── PID liveness 체크: 시그널 파일 없이 프로세스가 죽었으면 failed 처리 ──
  # PID 재사용 방지: kill -0 + 프로세스 명령어 검증
  local pidfile="${TMP_PREFIX}/worker-${task_id}.pid"
  if [ -f "$pidfile" ]; then
    local wpid
    wpid=$(cat "$pidfile" 2>/dev/null || true)
    if [ -n "$wpid" ]; then
      local pid_alive=true
      if ! kill -0 "$wpid" 2>/dev/null; then
        pid_alive=false
      else
        # PID 재사용 검증: 프로세스가 우리 워커인지 확인
        local proc_cmd
        proc_cmd=$(ps -p "$wpid" -o command= 2>/dev/null || echo "")
        if ! echo "$proc_cmd" | grep -qE "(job-task|job-review|claude)"; then
          echo "  ⚠️  ${task_id}: PID $wpid 재사용 감지 (실제: ${proc_cmd:0:50})"
          pid_alive=false
        fi
      fi
      if [ "$pid_alive" = false ]; then
        echo "  ⚠️  ${task_id}: 워커 프로세스(PID $wpid) 사망 감지 → failed 처리"
        _write_crashlog "$task_id" "워커 프로세스 비정상 종료 (시그널 파일 미생성)" "$wpid"
        rm -f "$pidfile"
        _mark_task_failed "$task_id" "워커 프로세스 비정상 종료 (PID $wpid, 시그널 파일 없음)"
        return 1
      fi
    fi
  else
    # PID 파일 자체가 없는데 in_progress → 비정상 상태
    local check_tf
    check_tf=$(find_file "$task_id")
    local check_status=""
    [ -n "$check_tf" ] && check_status=$(grep '^status:' "$check_tf" | awk '{print $2}')
    if [ "$check_status" = "in_progress" ]; then
      echo "  ⚠️  ${task_id}: PID 파일 없음 + in_progress → failed 처리"
      _write_crashlog "$task_id" "PID 파일 없음 + in_progress 상태 (워커 미시작 또는 비정상 종료)"
      _mark_task_failed "$task_id" "PID 파일 없음 (워커 미시작 또는 비정상 종료)"
      return 1
    fi
  fi

  return 2  # 프로세스 살아있음, 아직 진행 중
}

# ── review 스킵 판단 ─────────────────────────────────────
# 코드를 수정하지 않는 role은 리뷰 불필요
SKIP_REVIEW_ROLES="tech-writer"

should_skip_review() {
  local role="$1"
  [ -z "$role" ] && return 1  # role 없으면 리뷰 수행
  for skip_role in $SKIP_REVIEW_ROLES; do
    [ "$role" = "$skip_role" ] && return 0
  done
  return 1
}

# ── 머지 + done 처리 ─────────────────────────────────────
MERGE_LOCK_DIR="${TMP_PREFIX}/merge.lock"

_merge_and_done() {
  local task_id="$1"
  local local_task_file
  local_task_file=$(find_file "$task_id")

  if [ -n "$local_task_file" ]; then
    _set_status "$local_task_file" "done"
    _db_set_status "$task_id" "done"
    _db_insert_event "$task_id" "status_change" "done"
  fi

  local wt_path
  wt_path=$(get_worktree "$task_id")
  local branch
  branch=$(get_branch "$task_id")

  if [ -n "$branch" ]; then
    if git -C "$REPO_ROOT" log --oneline "${BASE_BRANCH}..$branch" 2>/dev/null | grep -q .; then
      echo "  🔀 ${task_id}: $branch → ${BASE_BRANCH} 머지"

      # ── merge 직렬화: lock 획득 (동시 머지 방지) ──
      local _merge_lock_acquired=false
      local _merge_wait=0
      while ! mkdir "$MERGE_LOCK_DIR" 2>/dev/null; do
        if [ "$_merge_wait" -ge 60 ]; then
          echo "  ⚠️  ${task_id}: merge lock 획득 타임아웃 (60초) → 강제 해제"
          rm -rf "$MERGE_LOCK_DIR" 2>/dev/null
          continue
        fi
        sleep 2
        _merge_wait=$((_merge_wait + 2))
      done
      _merge_lock_acquired=true
      echo "$task_id" > "$MERGE_LOCK_DIR/owner"

      # 로컬 변경 보호 (stash)
      local _stashed=false
      if ! git -C "$REPO_ROOT" diff --quiet 2>/dev/null || ! git -C "$REPO_ROOT" diff --cached --quiet 2>/dev/null; then
        git -C "$REPO_ROOT" stash push -m "merge-${task_id}" --include-untracked 2>/dev/null && _stashed=true
      fi
      local _merge_failed=false
      if ! git -C "$REPO_ROOT" merge "$branch" --no-ff --no-edit; then
        if ! resolve_merge_conflict "$REPO_ROOT" "$task_id" "$branch" "$BASE_BRANCH"; then
          _merge_failed=true
        fi
      fi
      # stash 복원
      if [ "$_stashed" = true ]; then
        git -C "$REPO_ROOT" stash pop 2>/dev/null || true
      fi

      # ── merge lock 해제 ──
      if [ "$_merge_lock_acquired" = true ]; then
        rm -rf "$MERGE_LOCK_DIR" 2>/dev/null
      fi

      if [ "$_merge_failed" = true ]; then
        _set_status "$local_task_file" "failed"
        _db_set_status "$task_id" "failed"
        _db_insert_event "$task_id" "status_change" "failed"
        git -C "$REPO_ROOT" add "$local_task_file"
        git -C "$REPO_ROOT" commit --only "$local_task_file" \
          -m "chore(${task_id}): status → failed (merge conflict)" || true
        git -C "$REPO_ROOT" branch -d "$branch" 2>/dev/null || true
        stop_dependents "$task_id"
        return 1
      fi
    fi
    git -C "$REPO_ROOT" branch -d "$branch" 2>/dev/null || true
  fi

  if [ -d "$wt_path" ]; then
    git -C "$REPO_ROOT" worktree remove "$wt_path" --force 2>/dev/null || true
  fi

  if [ -n "$local_task_file" ]; then
    git -C "$REPO_ROOT" add "$local_task_file"
    # commit은 메인 루프 끝에서 배치로 처리
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
    _set_status "$tf" "failed"
    _db_set_status "$task_id" "failed"
    _db_insert_event "$task_id" "status_change" "failed"
    git -C "$REPO_ROOT" add "$tf"
    # commit은 메인 루프 끝에서 배치로 처리
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
    _set_status "$tf" "rejected"
    _db_set_status "$task_id" "rejected"
    _db_insert_event "$task_id" "status_change" "rejected"
    git -C "$REPO_ROOT" add "$tf"
    # commit은 메인 루프 끝에서 배치로 처리
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

# ── RUNNING 상태 관리 (배열 + 파일 하이브리드) ──────────────
# 배열은 메인 루프 성능용, 파일은 재시작 복구용
_RUNNING_STATE_DIR="${TMP_PREFIX}/running"
mkdir -p "$_RUNNING_STATE_DIR" 2>/dev/null || true

_running_mark() { touch "$_RUNNING_STATE_DIR/$1" 2>/dev/null || true; }
_running_unmark() { rm -f "$_RUNNING_STATE_DIR/$1" 2>/dev/null || true; }
_running_is_marked() { [ -f "$_RUNNING_STATE_DIR/$1" ]; }

# 재시작 시 파일에서 RUNNING 복구
RUNNING=()
for _rf in "$_RUNNING_STATE_DIR"/*; do
  [ -f "$_rf" ] || continue
  _rtid=$(basename "$_rf")
  # 실제로 in_progress인지 확인
  _rtf=$(find_file "$_rtid" 2>/dev/null)
  if [ -n "$_rtf" ] && grep -q 'status: in_progress' "$_rtf" 2>/dev/null; then
    # PID 파일이 있고 프로세스가 살아있으면 복구
    if [ -f "/tmp/worker-${_rtid}.pid" ]; then
      _rpid=$(cat "/tmp/worker-${_rtid}.pid" 2>/dev/null || true)
      if [ -n "$_rpid" ] && kill -0 "$_rpid" 2>/dev/null; then
        RUNNING+=("$_rtid")
        echo "  🔄 재시작 복구: ${_rtid} (PID ${_rpid})"
        continue
      fi
    fi
    # 프로세스 죽었으면 파일 정리
    _running_unmark "$_rtid"
  else
    _running_unmark "$_rtid"
  fi
done
if [ "${#RUNNING[@]}" -gt 0 ]; then
  echo "  📋 복구된 실행 중 태스크: ${#RUNNING[@]}개"
fi

FAILED_COUNT=0
LOOP_COUNT=0

while true; do
  LOOP_COUNT=$((LOOP_COUNT + 1))
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
        # 실패 → 파일 상태도 정리
        FAILED_COUNT=$((FAILED_COUNT + 1))
        _running_unmark "$task_id"
      elif [ "$rc" -eq 3 ]; then
        # 사용자 요청에 의한 중지 → 실패 카운트 미증가, RUNNING에서 제거
        echo "  ⏹️  ${task_id}: 중지됨 (사용자 요청)"
        _running_unmark "$task_id"
      else
        # rc=0 (성공) → RUNNING에서 제거
        _running_unmark "$task_id"
      fi
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
    echo "  ⏳ 새 태스크 대기 중... (5초마다 스캔)"
    sleep 5
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
    _running_mark "$next_task"
    echo "  📊 슬롯: ${#RUNNING[@]}/${MAX_PARALLEL_TASK} (대기: $((${#QUEUE[@]} - qi)))"
  done

  # ── 주기적 health sweep: 10회 루프마다 in_progress 좀비 탐지 ──
  if [ $((LOOP_COUNT % 10)) -eq 0 ] && [ "${#RUNNING[@]}" -gt 0 ]; then
    for _hs_tid in "${RUNNING[@]}"; do
      [ -z "$_hs_tid" ] && continue
      _hs_pidfile="/tmp/worker-${_hs_tid}.pid"
      if [ -f "$_hs_pidfile" ]; then
        _hs_wpid=$(cat "$_hs_pidfile" 2>/dev/null || true)
        if [ -n "$_hs_wpid" ] && ! kill -0 "$_hs_wpid" 2>/dev/null; then
          echo "  🔍 [health-sweep] ${_hs_tid}: 워커(PID $_hs_wpid) 사망 감지 — 다음 루프에서 처리됨"
        fi
      fi
    done
  fi

  # ── 배치 git commit: staged된 태스크 상태 변경을 한 번에 커밋 ──
  if git -C "$REPO_ROOT" diff --cached --quiet 2>/dev/null; then
    : # staged 변경 없음
  else
    _staged_files=$(git -C "$REPO_ROOT" diff --cached --name-only 2>/dev/null | grep -c '\.md$' | tr -d '[:space:]' || echo 0)
    if [ -n "$_staged_files" ] && [ "$_staged_files" -gt 0 ] 2>/dev/null; then
      git -C "$REPO_ROOT" commit -m "chore: 태스크 상태 일괄 업데이트 (${_staged_files}건)" || true
    fi
  fi

  # fswatch 기반 이벤트 대기 (또는 fallback polling)
  wait_for_signal
done
