#!/bin/bash
set -euo pipefail

# Night Worker — 코드 스캔 → 태스크 자동 생성
# orchestrate.sh가 실행 중이면 생성된 태스크를 자동 처리
#
# Usage: ./scripts/night-worker.sh [options]
#   --until HH:MM       종료 시간 (기본: 07:00)
#   --budget N           예산 한도 USD (기본: unlimited)
#   --max-tasks N        최대 태스크 생성 수 (기본: 10)
#   --types type1,type2  태스크 유형 (typecheck,lint,unused,docs,test,review)
#   --instructions "..." 추가 지시

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$REPO_ROOT/scripts/lib/common.sh"
source "$REPO_ROOT/scripts/lib/sed-inplace.sh"
source "$REPO_ROOT/scripts/lib/merge-resolver.sh"

if [ -d "$REPO_ROOT/.orchestration/tasks" ]; then
  TASK_DIR="$REPO_ROOT/.orchestration/tasks"
else
  TASK_DIR="$REPO_ROOT/docs/task"
fi
if [ -d "$REPO_ROOT/.orchestration/output/logs" ]; then
  LOG_DIR="$REPO_ROOT/.orchestration/output/logs"
else
  LOG_DIR="$REPO_ROOT/output/logs"
fi
mkdir -p "$LOG_DIR"

NOTICE_API="http://localhost:3000/api/notices"

# ── 인자 파싱 ──────────────────────────────────────────
UNTIL_TIME="07:00"
BUDGET=""
MAX_TASKS=10
TYPES="typecheck,lint,review"
INSTRUCTIONS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --until) UNTIL_TIME="$2"; shift 2 ;;
    --budget) BUDGET="$2"; shift 2 ;;
    --max-tasks) MAX_TASKS="$2"; shift 2 ;;
    --types) TYPES="$2"; shift 2 ;;
    --instructions) INSTRUCTIONS="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── 상태 파일 ──────────────────────────────────────────
STATE_FILE="/tmp/night-worker.state"
LOG_FILE="$LOG_DIR/night-worker.log"
PID_FILE="/tmp/night-worker.pid"

echo $$ > "$PID_FILE"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" | tee -a "$LOG_FILE"
}

update_state() {
  cat > "$STATE_FILE" <<STEOF
{
  "status": "$1",
  "startedAt": "$STARTED_AT",
  "until": "$UNTIL_TIME",
  "budget": "${BUDGET:-unlimited}",
  "maxTasks": $MAX_TASKS,
  "tasksCreated": $TASKS_CREATED,
  "totalCost": "$TOTAL_COST",
  "pid": $$
}
STEOF
}

# ── 종료 조건 체크 ─────────────────────────────────────
should_stop() {
  # 시간 체크
  local now_minutes
  now_minutes=$(( $(date +%H) * 60 + $(date +%M) ))
  local until_h="${UNTIL_TIME%%:*}"
  local until_m="${UNTIL_TIME##*:}"
  local until_minutes=$(( until_h * 60 + until_m ))

  # 자정 넘기는 경우 처리 (예: 23:00 시작 → 07:00 종료)
  if [ "$until_minutes" -gt "$now_minutes" ]; then
    # 같은 날: 현재 > 종료 시간이면 중단
    if [ "$now_minutes" -ge "$until_minutes" ]; then
      log "⏰ 종료 시간 도달 ($UNTIL_TIME)"
      return 0
    fi
  fi

  # 예산 체크
  if [ -n "$BUDGET" ]; then
    local over
    over=$(echo "$TOTAL_COST $BUDGET" | awk '{print ($1 >= $2) ? "yes" : "no"}')
    if [ "$over" = "yes" ]; then
      log "💰 예산 한도 도달 (\$$TOTAL_COST / \$$BUDGET)"
      return 0
    fi
  fi

  # 태스크 수 체크
  if [ "$TASKS_CREATED" -ge "$MAX_TASKS" ]; then
    log "📋 최대 태스크 수 도달 ($TASKS_CREATED / $MAX_TASKS)"
    return 0
  fi

  return 1
}

# ── 다음 태스크 ID 계산 ────────────────────────────────
next_task_id() {
  local lock_file="$REPO_ROOT/.orchestration/task-id.lock"
  # 간단한 lock으로 동시 접근 방지
  while ! mkdir "$lock_file" 2>/dev/null; do
    sleep 1
  done
  trap "rmdir '$lock_file' 2>/dev/null" RETURN

  local max_num=0
  for f in "$TASK_DIR"/TASK-*.md; do
    [ -f "$f" ] || continue
    local num
    num=$(basename "$f" | grep -o 'TASK-[0-9]*' | grep -o '[0-9]*')
    if [ -n "$num" ] && [ "$num" -gt "$max_num" ]; then
      max_num="$num"
    fi
  done
  local next_id
  next_id=$(printf "TASK-%03d" $((max_num + 1)))
  # 빈 파일 미리 생성하여 ID 예약
  touch "$TASK_DIR/${next_id}-reserved.md"
  echo "$next_id"
}

# ── Claude로 코드 스캔 → 이슈 발견 ───────────────────
scan_and_create_task() {
  local scan_type="$1"

  local type_prompt=""
  case "$scan_type" in
    typecheck) type_prompt="TypeScript 타입 오류를 찾아서 수정 태스크를 만들어주세요. strict 모드 기준으로 검사하세요." ;;
    lint) type_prompt="ESLint 위반, 코드 스타일 문제를 찾아서 수정 태스크를 만들어주세요." ;;
    unused) type_prompt="사용하지 않는 import, 변수, 함수, 파일을 찾아서 정리 태스크를 만들어주세요." ;;
    docs) type_prompt="코드 분석 후 docs/todo/ 에 분석 보고서를 작성하는 태스크를 만들어주세요." ;;
    test) type_prompt="테스트 커버리지가 부족한 부분을 찾아서 테스트 작성 태스크를 만들어주세요." ;;
    review) type_prompt="코드 품질 문제(복잡도, 중복, 안티패턴)를 찾아서 검토 보고서 태스크를 만들어주세요." ;;
  esac

  local task_id
  task_id=$(next_task_id)

  local today
  today=$(date '+%Y-%m-%d')

  local instructions_line=""
  [ -n "${INSTRUCTIONS:-}" ] && instructions_line="추가 지시: $INSTRUCTIONS"

  local prompt
  prompt=$(render_template "prompt/night-scan.md" \
    "type_prompt=${type_prompt}" \
    "instructions=${instructions_line}" \
    "task_id=${task_id}" \
    "date=${today}")

  log "🔍 스캔 시작: $scan_type → 발견 시 ${task_id}로 생성"
  log "   프롬프트 길이: $(echo "$prompt" | wc -c | tr -d ' ')자"

  local output_file="$LOG_DIR/night-worker-scan-${task_id}.json"
  cd "$REPO_ROOT"

  local start_time
  start_time=$(date +%s)

  local result
  result=$(echo "$prompt" | claude --output-format json --dangerously-skip-permissions 2>/dev/null) || true

  local elapsed=$(( $(date +%s) - start_time ))

  if [ -z "$result" ]; then
    log "  ❌ Claude 호출 실패 (${elapsed}초 소요)"
    rm -f "$TASK_DIR/${task_id}-reserved.md"
    return 1
  fi

  # 비용 추적
  local cost
  cost=$(echo "$result" | jq -r '.total_cost_usd // 0' 2>/dev/null) || cost="0"
  local tokens
  tokens=$(echo "$result" | jq -r '.usage.output_tokens // 0' 2>/dev/null) || tokens="0"
  TOTAL_COST=$(echo "$TOTAL_COST $cost" | awk '{printf "%.4f", $1 + $2}')
  log "  💰 응답 수신 (${elapsed}초, \$${cost}, ${tokens} tokens)"

  # JSON에서 result 필드 추출
  local task_content
  task_content=$(echo "$result" | jq -r '.result // empty' 2>/dev/null) || true

  if [ -z "$task_content" ] || echo "$task_content" | grep -q "NOT_FOUND"; then
    log "  ℹ️  이슈 없음 ($scan_type)"
    rm -f "$TASK_DIR/${task_id}-reserved.md"
    return 1
  fi

  log "  📄 응답 미리보기: $(echo "$task_content" | head -1 | cut -c1-80)"

  # frontmatter가 포함된 응답에서 태스크 파일 생성
  # Claude 응답에서 --- 블록 찾기
  local title=""

  # 방법1: frontmatter 안의 title
  if echo "$task_content" | grep -q '^---'; then
    title=$(echo "$task_content" | sed -n '/^---$/,/^---$/p' | grep '^title:' | head -1 | sed 's/^title: *//')
  fi

  # 방법2: 그냥 title: 로 시작하는 줄
  if [ -z "$title" ]; then
    title=$(echo "$task_content" | grep -i '^title:' | head -1 | sed 's/^[Tt]itle: *//')
  fi

  # 방법3: 첫 번째 # 헤딩
  if [ -z "$title" ]; then
    title=$(echo "$task_content" | grep '^# ' | head -1 | sed 's/^# *//')
  fi

  if [ -z "$title" ]; then
    log "  ⚠️  태스크 제목 추출 실패 — 응답 앞부분: $(echo "$task_content" | head -3 | tr '\n' ' ')"
    rm -f "$TASK_DIR/${task_id}-reserved.md"
    return 1
  fi

  local slug
  slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9가-힣]/-/g' | sed 's/-\+/-/g' | head -c 50 | sed 's/-$//')
  local filename="${task_id}-${slug}.md"
  local filepath="$TASK_DIR/$filename"

  rm -f "$TASK_DIR/${task_id}-reserved.md"

  # frontmatter가 없으면 직접 생성
  if echo "$task_content" | head -1 | grep -q '^---$'; then
    echo "$task_content" | sed "s/^id: .*/id: ${task_id}/" > "$filepath"
  else
    render_template "entity/task-night.md" \
      "task_id=${task_id}" \
      "title=${title}" \
      "date=$(date '+%Y-%m-%d')" \
      "scope= []" \
      "content=${task_content}" \
      "criteria=" > "$filepath"
  fi
  log "  ✅ 태스크 생성: $task_id - $title"
  log "     파일: $filename"

  # git add + commit
  git -C "$REPO_ROOT" add "$filepath"
  git -C "$REPO_ROOT" commit --only "$filepath" -m "chore(${task_id}): Night Worker 자동 생성 (${scan_type})" || true

  TASKS_CREATED=$((TASKS_CREATED + 1))
  return 0
}

# ── 메인 루프 ──────────────────────────────────────────

STARTED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
TASKS_CREATED=0
TOTAL_COST="0"

log "🌙 Night Worker 시작"
log "   종료: $UNTIL_TIME / 예산: ${BUDGET:-unlimited} / 최대: ${MAX_TASKS}개"
log "   유형: $TYPES"
[ -n "$INSTRUCTIONS" ] && log "   지시: $INSTRUCTIONS"

update_state "running"

# 유형 목록을 배열로
IFS=',' read -ra TYPE_LIST <<< "$TYPES"
type_index=0

while true; do
  # 종료 조건 체크
  if should_stop; then
    break
  fi

  # 현재 유형으로 스캔
  current_type="${TYPE_LIST[$type_index]}"

  if scan_and_create_task "$current_type"; then
    update_state "running"
  fi

  # 다음 유형으로 순환
  type_index=$(( (type_index + 1) % ${#TYPE_LIST[@]} ))

  # 모든 유형을 한 바퀴 돌았으면 잠시 대기
  if [ "$type_index" -eq 0 ]; then
    log "⏳ 다음 스캔 대기 (60초)..."
    sleep 60
  else
    sleep 5
  fi
done

# ── 아침 요약 Notice ───────────────────────────────────
log "🌅 Night Worker 종료"
log "   생성: ${TASKS_CREATED}개 / 비용: \$${TOTAL_COST}"

update_state "completed"

post_notice "info" \
  "Night Worker 야간 작업 완료" \
  "**실행 시간:** ${STARTED_AT} → $(date -u '+%Y-%m-%dT%H:%M:%SZ')\n**생성 태스크:** ${TASKS_CREATED}개\n**총 비용:** \$${TOTAL_COST}\n**유형:** ${TYPES}\n\n야간 작업이 완료되었습니다. 생성된 태스크를 확인해주세요."

rm -f "$PID_FILE"
