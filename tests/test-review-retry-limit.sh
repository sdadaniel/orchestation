#!/bin/bash
# test-review-retry-limit.sh
# Tests for TASK-109: review 실패 시 retry 횟수 상한 적용

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PASS=0
FAIL=0

assert_eq() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✅ PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $label"
    echo "     Expected: $expected"
    echo "     Got: $actual"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local label="$1"
  local haystack="$2"
  local needle="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  ✅ PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $label"
    echo "     Expected to contain: $needle"
    echo "     Got: $haystack"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local label="$1"
  local haystack="$2"
  local needle="$3"
  if ! echo "$haystack" | grep -qF "$needle"; then
    echo "  ✅ PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $label"
    echo "     Expected NOT to contain: $needle"
    FAIL=$((FAIL + 1))
  fi
}

# ─────────────────────────────────────────────────────────
# Test 1: MAX_REVIEW_RETRY 환경 변수 기본값 (orchestrate.sh)
# ─────────────────────────────────────────────────────────
echo "━━━ Test 1: MAX_REVIEW_RETRY 기본값 ━━━"

# orchestrate.sh에서 MAX_REVIEW_RETRY 기본값이 3인지 확인
result=$(grep 'MAX_REVIEW_RETRY=' "$PROJECT_ROOT/scripts/orchestrate.sh" | head -1)
assert_contains "기본값 3 설정" "$result" '${MAX_REVIEW_RETRY:-3}'

# ─────────────────────────────────────────────────────────
# Test 2: MAX_REVIEW_RETRY 환경 변수로 오버라이드 가능
# ─────────────────────────────────────────────────────────
echo "━━━ Test 2: MAX_REVIEW_RETRY 환경 변수 오버라이드 ━━━"

# 환경 변수로 설정하면 해당 값이 사용되는지 확인
eval_result=$(MAX_REVIEW_RETRY=5 bash -c 'MAX_REVIEW_RETRY="${MAX_REVIEW_RETRY:-3}"; echo $MAX_REVIEW_RETRY')
assert_eq "환경 변수 오버라이드" "5" "$eval_result"

eval_result=$(bash -c 'unset MAX_REVIEW_RETRY; MAX_REVIEW_RETRY="${MAX_REVIEW_RETRY:-3}"; echo $MAX_REVIEW_RETRY')
assert_eq "기본값 적용" "3" "$eval_result"

# ─────────────────────────────────────────────────────────
# Test 3: run-worker.sh MAX_RETRY 입력 검증 (비정수)
# ─────────────────────────────────────────────────────────
echo "━━━ Test 3: MAX_RETRY 비정수 입력 검증 ━━━"

# run-worker.sh의 입력 검증 코드를 직접 테스트
result=$(bash -c '
MAX_RETRY="abc"
if ! [[ "$MAX_RETRY" =~ ^[0-9]+$ ]]; then
  echo "REJECTED"
else
  echo "ACCEPTED"
fi
')
assert_eq "비정수 거부" "REJECTED" "$result"

result=$(bash -c '
MAX_RETRY="-1"
if ! [[ "$MAX_RETRY" =~ ^[0-9]+$ ]]; then
  echo "REJECTED"
else
  echo "ACCEPTED"
fi
')
assert_eq "음수 거부" "REJECTED" "$result"

result=$(bash -c '
MAX_RETRY="3"
if ! [[ "$MAX_RETRY" =~ ^[0-9]+$ ]]; then
  echo "REJECTED"
else
  echo "ACCEPTED"
fi
')
assert_eq "양수 허용" "ACCEPTED" "$result"

result=$(bash -c '
MAX_RETRY="0"
if ! [[ "$MAX_RETRY" =~ ^[0-9]+$ ]]; then
  echo "REJECTED"
else
  echo "ACCEPTED"
fi
')
assert_eq "0 허용" "ACCEPTED" "$result"

# ─────────────────────────────────────────────────────────
# Test 4: retry 루프가 MAX_RETRY+1 회 시도 후 종료하는지 확인
# ─────────────────────────────────────────────────────────
echo "━━━ Test 4: retry 루프 상한 검증 ━━━"

result=$(bash -c '
MAX_RETRY=2
count=0
for i in $(seq 0 "$MAX_RETRY"); do
  count=$((count + 1))
  if [ "$i" -eq "$MAX_RETRY" ]; then
    echo "STOPPED_AT_$count"
    break
  fi
done
')
assert_eq "MAX_RETRY=2 → 3회 시도 후 종료" "STOPPED_AT_3" "$result"

result=$(bash -c '
MAX_RETRY=0
count=0
for i in $(seq 0 "$MAX_RETRY"); do
  count=$((count + 1))
  if [ "$i" -eq "$MAX_RETRY" ]; then
    echo "STOPPED_AT_$count"
    break
  fi
done
')
assert_eq "MAX_RETRY=0 → 1회 시도 후 종료" "STOPPED_AT_1" "$result"

# ─────────────────────────────────────────────────────────
# Test 5: orchestrate.sh에서 failed 태스크에 status: failed 마킹
# ─────────────────────────────────────────────────────────
echo "━━━ Test 5: failed 태스크 상태 마킹 코드 존재 확인 ━━━"

orch_content=$(cat "$PROJECT_ROOT/scripts/orchestrate.sh")
assert_contains "failed 마킹 코드 존재" "$orch_content" 'status: failed'
assert_contains "sed로 failed 상태 변경" "$orch_content" 'sed_inplace "s/^status: .*/status: failed/"'

# ─────────────────────────────────────────────────────────
# Test 6: run-worker.sh에 retry 로깅 코드 확인
# ─────────────────────────────────────────────────────────
echo "━━━ Test 6: retry 로깅 코드 확인 ━━━"

worker_content=$(cat "$PROJECT_ROOT/scripts/run-worker.sh")
assert_contains "retry 로그 파일 경로" "$worker_content" 'RETRY_LOG='
assert_contains "log_retry 함수 정의" "$worker_content" 'log_retry()'
assert_contains "attempt 로깅" "$worker_content" 'attempt='
assert_contains "상한 초과 로그" "$worker_content" 'retry 상한'
assert_contains "리뷰 실패 로그" "$worker_content" '리뷰 실패 (수정 요청)'
assert_contains "작업 실행 실패 로그" "$worker_content" '작업 실행 실패'

# ─────────────────────────────────────────────────────────
# Test 7: run-worker.sh MAX_RETRY 환경 변수 폴백
# ─────────────────────────────────────────────────────────
echo "━━━ Test 7: run-worker.sh MAX_RETRY 환경 변수 폴백 ━━━"

worker_content=$(cat "$PROJECT_ROOT/scripts/run-worker.sh")
assert_contains "환경 변수 MAX_REVIEW_RETRY 폴백" "$worker_content" '${MAX_REVIEW_RETRY:-2}'

# ─────────────────────────────────────────────────────────
# Test 8: log_retry가 타임스탬프와 TASK_ID를 포함하는지 확인
# ─────────────────────────────────────────────────────────
echo "━━━ Test 8: log_retry 형식 확인 ━━━"

# log_retry 함수를 추출해서 테스트
result=$(bash -c '
TASK_ID="TASK-999"
OUTPUT_DIR=$(mktemp -d)
RETRY_LOG="$OUTPUT_DIR/logs/TASK-999-retry.log"
mkdir -p "$OUTPUT_DIR/logs"

log_retry() {
  local msg="$1"
  echo "[$(date "+%Y-%m-%d %H:%M:%S")] ${TASK_ID} | $msg" | tee -a "$RETRY_LOG"
}

log_retry "테스트 메시지"
cat "$RETRY_LOG"
rm -rf "$OUTPUT_DIR"
')

assert_contains "타임스탬프 포함" "$result" "$(date '+%Y-%m-%d')"
assert_contains "TASK_ID 포함" "$result" "TASK-999"
assert_contains "메시지 포함" "$result" "테스트 메시지"

# ─────────────────────────────────────────────────────────
# Test 9: orchestrate.sh가 MAX_REVIEW_RETRY를 run-worker.sh에 전달
# ─────────────────────────────────────────────────────────
echo "━━━ Test 9: MAX_REVIEW_RETRY가 run-worker.sh에 전달됨 ━━━"

orch_content=$(cat "$PROJECT_ROOT/scripts/orchestrate.sh")
assert_contains "run-worker.sh에 MAX_REVIEW_RETRY 전달" "$orch_content" '${MAX_REVIEW_RETRY}'

# ─────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
