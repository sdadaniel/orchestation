#!/bin/bash
# Test: array expansion patterns used in auto-improve.sh
# Verifies safety under set -u for empty, single, and multi-element arrays
set -euo pipefail

PASS=0
FAIL=0

pass() { echo "  ✅ PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "=== Test 1: Empty array — length guard prevents unbound error ==="
declare -a EMPTY_ARR=()
if [[ ${#EMPTY_ARR[@]} -eq 0 ]]; then
  pass "empty array length check"
else
  fail "empty array length check"
fi

# Guarded iteration on empty array
iterated=false
if [[ ${#EMPTY_ARR[@]} -gt 0 ]]; then
  for item in "${EMPTY_ARR[@]}"; do iterated=true; done
fi
if [[ "$iterated" == false ]]; then
  pass "guarded empty array skips iteration"
else
  fail "guarded empty array skips iteration"
fi

echo ""
echo "=== Test 2: Single-element array ==="
declare -a SINGLE_ARR=("one")
count=0
if [[ ${#SINGLE_ARR[@]} -gt 0 ]]; then
  for item in "${SINGLE_ARR[@]}"; do count=$((count + 1)); done
fi
if [[ $count -eq 1 ]]; then
  pass "single element iterated once"
else
  fail "single element iterated once (got $count)"
fi

echo ""
echo "=== Test 3: Multi-element array ==="
declare -a MULTI_ARR=("a" "b" "c")
count=0
if [[ ${#MULTI_ARR[@]} -gt 0 ]]; then
  for item in "${MULTI_ARR[@]}"; do count=$((count + 1)); done
fi
if [[ $count -eq 3 ]]; then
  pass "multi elements iterated correctly"
else
  fail "multi elements iterated correctly (got $count)"
fi

echo ""
echo "=== Test 4: Array copy with guard ==="
declare -a SRC=("x" "y")
declare -a DST=()
if [[ ${#SRC[@]} -gt 0 ]]; then
  DST=("${SRC[@]}")
fi
if [[ ${#DST[@]} -eq 2 ]]; then
  pass "copy non-empty array"
else
  fail "copy non-empty array (got ${#DST[@]})"
fi

declare -a EMPTY_SRC=()
declare -a EMPTY_DST=()
if [[ ${#EMPTY_SRC[@]} -gt 0 ]]; then
  EMPTY_DST=("${EMPTY_SRC[@]}")
fi
if [[ ${#EMPTY_DST[@]} -eq 0 ]]; then
  pass "skip copy of empty array"
else
  fail "skip copy of empty array"
fi

echo ""
echo "=== Test 5: IFS read into array with guard ==="
IFS=',' read -ra PARSED <<< "a,b,c"
count=0
if [[ ${#PARSED[@]} -gt 0 ]]; then
  for p in "${PARSED[@]}"; do count=$((count + 1)); done
fi
if [[ $count -eq 3 ]]; then
  pass "IFS read + guarded iteration"
else
  fail "IFS read + guarded iteration (got $count)"
fi

echo ""
echo "=== Test 6: String expansion with guard ==="
declare -a STR_ARR=("hello" "world")
if [[ ${#STR_ARR[@]} -gt 0 ]]; then
  msg="Items: ${STR_ARR[*]}"
  if [[ "$msg" == "Items: hello world" ]]; then
    pass "array in string expansion"
  else
    fail "array in string expansion (got: $msg)"
  fi
else
  fail "array in string expansion (guard failed)"
fi

echo ""
echo "=== Test 7: set -u with empty array length check does not error ==="
# This is the key test — ${#ARR[@]} must work on empty arrays under set -u
declare -a TEST_EMPTY=()
len=${#TEST_EMPTY[@]}
if [[ $len -eq 0 ]]; then
  pass "empty array length under set -u"
else
  fail "empty array length under set -u"
fi

echo ""
echo "==============================="
echo "Results: $PASS passed, $FAIL failed"
echo "==============================="

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
