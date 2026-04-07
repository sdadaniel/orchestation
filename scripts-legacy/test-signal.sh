#!/bin/bash
set -euo pipefail

# Test script for signal.sh - validates atomic signal operations
# Tests: create, check, consume, wait_all, and parallel race condition safety

PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$PACKAGE_DIR/scripts/lib/signal.sh"

TEST_DIR=$(mktemp -d /tmp/test-signal-XXXXXX)
trap 'rm -rf "$TEST_DIR"' EXIT

PASS=0
FAIL=0

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✅ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $desc (expected='$expected', actual='$actual')"
    FAIL=$((FAIL + 1))
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Signal Library Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 1: signal_create + signal_check
echo ""
echo "▶ Test 1: signal_create and signal_check"
signal_create "$TEST_DIR" "TASK-001" "done"
assert_eq "done file exists" "0" "$([ -f "$TEST_DIR/TASK-001-done" ] && echo 0 || echo 1)"
assert_eq "no temp files left" "0" "$(ls "$TEST_DIR"/TASK-001-done.tmp.* 2>/dev/null | wc -l | tr -d ' ')"

signal_check "$TEST_DIR" "TASK-001"
assert_eq "signal_check detects done" "done" "$SIGNAL_TYPE"

# Test 2: signal_create failed
echo ""
echo "▶ Test 2: signal_create failed type"
signal_create "$TEST_DIR" "TASK-002" "failed"
signal_check "$TEST_DIR" "TASK-002"
assert_eq "signal_check detects failed" "failed" "$SIGNAL_TYPE"

# Test 3: signal_check returns 1 when no signal
echo ""
echo "▶ Test 3: signal_check with no signal"
if signal_check "$TEST_DIR" "TASK-999"; then
  assert_eq "should not find signal" "not_found" "found"
else
  assert_eq "no signal returns 1" "true" "true"
fi

# Test 4: signal_consume atomically removes file
echo ""
echo "▶ Test 4: signal_consume"
signal_create "$TEST_DIR" "TASK-003" "done"
signal_consume "$TEST_DIR" "TASK-003"
assert_eq "consume returns done" "done" "$SIGNAL_TYPE"
assert_eq "file removed after consume" "1" "$([ -f "$TEST_DIR/TASK-003-done" ] && echo 0 || echo 1)"

# Test 5: signal_consume returns 1 when already consumed
echo ""
echo "▶ Test 5: double consume prevented"
if signal_consume "$TEST_DIR" "TASK-003"; then
  assert_eq "should not double-consume" "fail" "success"
else
  assert_eq "second consume fails" "true" "true"
fi

# Test 6: signal_consume for failed
echo ""
echo "▶ Test 6: signal_consume failed type"
signal_create "$TEST_DIR" "TASK-004" "failed"
signal_consume "$TEST_DIR" "TASK-004"
assert_eq "consume returns failed" "failed" "$SIGNAL_TYPE"

# Test 7: signal_wait_all
echo ""
echo "▶ Test 7: signal_wait_all"
signal_create "$TEST_DIR" "TASK-010" "done"
signal_create "$TEST_DIR" "TASK-011" "failed"
signal_wait_all "$TEST_DIR" "TASK-010" "TASK-011"
assert_eq "wait_all completes" "true" "true"

# Test 8: Parallel race condition test
echo ""
echo "▶ Test 8: Parallel signal creation (race condition test)"
RACE_DIR=$(mktemp -d /tmp/test-signal-race-XXXXXX)

# Launch 20 parallel workers creating signals simultaneously
for i in $(seq 1 20); do
  (
    source "$PACKAGE_DIR/scripts/lib/signal.sh"
    signal_create "$RACE_DIR" "TASK-R$(printf '%03d' $i)" "done"
  ) &
done
wait

# Verify all 20 signals exist
CREATED=$(ls "$RACE_DIR"/TASK-R*-done 2>/dev/null | wc -l | tr -d ' ')
assert_eq "all 20 parallel signals created" "20" "$CREATED"

# Verify no temp files remain
TEMPS=$(find "$RACE_DIR" -name "*.tmp.*" -type f 2>/dev/null | wc -l | tr -d ' ')
assert_eq "no temp files after parallel create" "0" "$TEMPS"

# Test 9: Parallel consume (only one consumer should succeed per signal)
echo ""
echo "▶ Test 9: Parallel consume (double-consume prevention)"
signal_create "$RACE_DIR" "TASK-RACE" "done"

CONSUME_RESULTS="$RACE_DIR/consume-results"
for i in $(seq 1 10); do
  (
    source "$PACKAGE_DIR/scripts/lib/signal.sh"
    if signal_consume "$RACE_DIR" "TASK-RACE"; then
      echo "consumed" >> "$CONSUME_RESULTS"
    fi
  ) &
done
wait

CONSUME_COUNT=$(wc -l < "$CONSUME_RESULTS" 2>/dev/null | tr -d ' ')
assert_eq "exactly 1 consumer succeeds" "1" "$CONSUME_COUNT"

rm -rf "$RACE_DIR"

# Test 10: Input validation
echo ""
echo "▶ Test 10: Input validation"
if signal_create "" "" "" 2>/dev/null; then
  assert_eq "empty args should fail" "fail" "success"
else
  assert_eq "empty args rejected" "true" "true"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: ${PASS} passed, ${FAIL} failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
