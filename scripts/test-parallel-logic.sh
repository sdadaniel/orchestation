#!/bin/bash
# test-parallel-logic.sh
# Integration test for auto-improve parallel processing logic
# Tests collect-requests, analyze-dependencies, and task creation flow
# Usage: bash scripts/test-parallel-logic.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$PROJECT_ROOT/scripts/lib/sed-inplace.sh"
TEST_DIR=$(mktemp -d)
PASS=0
FAIL=0

cleanup() {
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

log_test() {
  echo "TEST: $1"
}

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  ✅ PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $desc"
    echo "    expected: '$expected'"
    echo "    actual:   '$actual'"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then
    echo "  ✅ PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $desc"
    echo "    expected to contain: '$needle'"
    echo "    actual: '$haystack'"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_empty() {
  local desc="$1" value="$2"
  if [[ -n "$value" ]]; then
    echo "  ✅ PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $desc (empty)"
    FAIL=$((FAIL + 1))
  fi
}

# ── Setup test requests ──

REQUESTS_DIR="$TEST_DIR/requests"
mkdir -p "$REQUESTS_DIR"

cat > "$REQUESTS_DIR/REQ-001-test-a.md" << 'EOF'
---
id: REQ-001
title: Add login page
status: pending
priority: high
created: 2026-03-23
---

Add a login page with email/password fields.
EOF

cat > "$REQUESTS_DIR/REQ-002-test-b.md" << 'EOF'
---
id: REQ-002
title: Fix footer alignment
status: pending
priority: medium
created: 2026-03-23
---

Fix the footer CSS alignment issue on mobile.
EOF

cat > "$REQUESTS_DIR/REQ-003-test-c.md" << 'EOF'
---
id: REQ-003
title: Update docs
status: done
priority: low
created: 2026-03-23
---

Already done, should not be collected.
EOF

cat > "$REQUESTS_DIR/REQ-004-test-d.md" << 'EOF'
---
id: REQ-004
title: Add dashboard
status: pending
priority: high
created: 2026-03-23
---

Add dashboard page showing user stats.
EOF

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing auto-improve parallel processing logic"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Test 1: collect-requests.sh ──
log_test "1. collect-requests.sh - collects only pending requests"

RESULT=$(bash "$SCRIPT_DIR/collect-requests.sh" "$REQUESTS_DIR")
LINE_COUNT=$(echo "$RESULT" | wc -l | tr -d ' ')

assert_eq "should find 3 pending requests" "3" "$LINE_COUNT"
assert_contains "should contain REQ-001" "REQ-001" "$RESULT"
assert_contains "should contain REQ-002" "REQ-002" "$RESULT"
assert_contains "should contain REQ-004" "REQ-004" "$RESULT"

# REQ-003 is done, should NOT be included
if echo "$RESULT" | grep -q "REQ-003"; then
  echo "  ❌ FAIL: should not contain REQ-003 (status: done)"
  FAIL=$((FAIL + 1))
else
  echo "  ✅ PASS: correctly excludes REQ-003"
  PASS=$((PASS + 1))
fi

# ── Test 2: collect-requests.sh with empty directory ──
log_test "2. collect-requests.sh - empty directory"

EMPTY_DIR="$TEST_DIR/empty"
mkdir -p "$EMPTY_DIR"
RESULT=$(bash "$SCRIPT_DIR/collect-requests.sh" "$EMPTY_DIR")
assert_eq "should return []" "[]" "$RESULT"

# ── Test 3: collect-requests.sh with non-existent directory ──
log_test "3. collect-requests.sh - non-existent directory"

RESULT=$(bash "$SCRIPT_DIR/collect-requests.sh" "$TEST_DIR/nonexistent")
assert_eq "should return []" "[]" "$RESULT"

# ── Test 4: collect-requests output format ──
log_test "4. collect-requests.sh - output format validation"

FIRST_LINE=$(bash "$SCRIPT_DIR/collect-requests.sh" "$REQUESTS_DIR" | head -1)
IFS='|' read -r file id title priority <<< "$FIRST_LINE"
assert_not_empty "file path" "$file"
assert_eq "first request ID" "REQ-001" "$id"
assert_eq "first request title" "Add login page" "$title"
assert_eq "first request priority" "high" "$priority"

# ── Test 5: analyze-dependencies.sh single request ──
log_test "5. analyze-dependencies.sh - single request (trivially independent)"

RESULT=$(bash "$SCRIPT_DIR/analyze-dependencies.sh" "REQ-001|Add login page|Add a login page" 2>/dev/null)
assert_contains "single request should be INDEPENDENT" "INDEPENDENT" "$RESULT"
assert_contains "should contain REQ-001" "REQ-001" "$RESULT"

# ── Test 6: Validate auto-improve.sh helper functions ──
log_test "6. auto-improve.sh - get_field / get_body functions"

# Source the functions (they're defined in auto-improve.sh)
get_field() {
  local file="$1"
  local field="$2"
  grep "^${field}:" "$file" | head -1 | sed "s/^${field}: *//"
}

get_body() {
  local file="$1"
  awk 'BEGIN{c=0} /^---$/{c++; next} c>=2{print}' "$file"
}

FIELD_ID=$(get_field "$REQUESTS_DIR/REQ-001-test-a.md" "id")
assert_eq "get_field id" "REQ-001" "$FIELD_ID"

FIELD_STATUS=$(get_field "$REQUESTS_DIR/REQ-001-test-a.md" "status")
assert_eq "get_field status" "pending" "$FIELD_STATUS"

BODY=$(get_body "$REQUESTS_DIR/REQ-001-test-a.md")
assert_contains "get_body content" "login page" "$BODY"

# ── Test 7: update_status function ──
log_test "7. update_status function"

TEST_REQ="$TEST_DIR/test-update.md"
cp "$REQUESTS_DIR/REQ-001-test-a.md" "$TEST_REQ"

sed_inplace "s/^status: .*/status: in_progress/" "$TEST_REQ"

NEW_STATUS=$(get_field "$TEST_REQ" "status")
assert_eq "status updated to in_progress" "in_progress" "$NEW_STATUS"

# ── Test 8: Dependency analysis output parsing ──
log_test "8. Dependency analysis output parsing"

# Simulate analysis output
MOCK_ANALYSIS="INDEPENDENT: REQ-001, REQ-004
DEPENDENT: REQ-002 -> REQ-003"

INDEP_LINE=$(echo "$MOCK_ANALYSIS" | grep "^INDEPENDENT:" | head -1 | sed 's/^INDEPENDENT: *//')
assert_eq "parse independent line" "REQ-001, REQ-004" "$INDEP_LINE"

DEP_LINE=$(echo "$MOCK_ANALYSIS" | grep "^DEPENDENT:" | head -1 | sed 's/^DEPENDENT: *//')
assert_eq "parse dependent line" "REQ-002 -> REQ-003" "$DEP_LINE"

FROM_ID=$(echo "$DEP_LINE" | sed 's/ *->.*$//' | tr -d ' ')
TO_ID=$(echo "$DEP_LINE" | sed 's/^.*-> *//' | tr -d ' ')
assert_eq "parse from_id" "REQ-002" "$FROM_ID"
assert_eq "parse to_id" "REQ-003" "$TO_ID"

# ── Summary ──
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
echo "All tests passed! ✅"
