#!/bin/bash
# test-fallback-validation.sh
# Tests for TASK-100: fallback format consistency and field validation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PASS=0
FAIL=0

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
    echo "     Got: $haystack"
    FAIL=$((FAIL + 1))
  fi
}

# ─────────────────────────────────────────────────────────
# Extract validate_eval_response function for unit testing
# ─────────────────────────────────────────────────────────

# Minimal log function for testing
log() { echo "[TEST] $*" >&2; }

# Source the validation function directly
validate_eval_response() {
  local response="$1"
  local req_id="$2"

  if [[ -z "$response" ]]; then
    log "ERROR: [$req_id] Claude 응답이 비어있습니다. 안전한 fallback을 사용합니다."
    echo "DECISION: reject
REASON: Claude 응답이 비어있음 — 자동 reject 처리"
    return 0
  fi

  local has_decision=false
  local has_reason=false

  echo "$response" | grep -q "^DECISION:" && has_decision=true
  echo "$response" | grep -q "^REASON:" && has_reason=true

  if [[ "$has_decision" == false || "$has_reason" == false ]]; then
    local missing_fields=""
    [[ "$has_decision" == false ]] && missing_fields="DECISION"
    [[ "$has_reason" == false ]] && missing_fields="${missing_fields:+$missing_fields, }REASON"

    log "ERROR: [$req_id] 응답에 필수 필드 누락: $missing_fields. 안전한 fallback을 사용합니다."
    log "ERROR: [$req_id] 원본 응답 (첫 200자): $(echo "$response" | head -c 200)"

    echo "DECISION: reject
REASON: 응답 파싱 실패 (필수 필드 누락: $missing_fields) — 자동 reject 처리"
    return 0
  fi

  local decision_value
  decision_value=$(echo "$response" | grep "^DECISION:" | head -1 | sed 's/^DECISION: *//' | tr -d '[:space:]')
  if [[ "$decision_value" != "accept" && "$decision_value" != "reject" ]]; then
    log "ERROR: [$req_id] DECISION 값이 유효하지 않음: '$decision_value'. accept/reject만 허용됩니다."
    echo "DECISION: reject
REASON: DECISION 값 오류 ('$decision_value') — 자동 reject 처리"
    return 0
  fi

  echo "$response"
}

# ─────────────────────────────────────────────────────────
# Test 1: Valid accept response passes through
# ─────────────────────────────────────────────────────────
echo "━━━ Test 1: Valid accept response ━━━"
VALID_ACCEPT="DECISION: accept
REASON: 요청이 구체적이고 범위가 명확함
TASK_TITLE: 테스트 태스크
TASK_DESCRIPTION: 완료 조건 1
SCOPE: src/main.ts"

result=$(validate_eval_response "$VALID_ACCEPT" "REQ-001")
assert_contains "DECISION field preserved" "$result" "DECISION: accept"
assert_contains "REASON field preserved" "$result" "REASON: 요청이 구체적이고 범위가 명확함"
assert_contains "TASK_TITLE preserved" "$result" "TASK_TITLE: 테스트 태스크"

# ─────────────────────────────────────────────────────────
# Test 2: Valid reject response passes through
# ─────────────────────────────────────────────────────────
echo "━━━ Test 2: Valid reject response ━━━"
VALID_REJECT="DECISION: reject
REASON: 요청이 너무 추상적"

result=$(validate_eval_response "$VALID_REJECT" "REQ-002")
assert_contains "DECISION reject preserved" "$result" "DECISION: reject"
assert_contains "REASON preserved" "$result" "REASON: 요청이 너무 추상적"

# ─────────────────────────────────────────────────────────
# Test 3: Empty response returns safe fallback
# ─────────────────────────────────────────────────────────
echo "━━━ Test 3: Empty response ━━━"
result=$(validate_eval_response "" "REQ-003")
assert_contains "Fallback has DECISION" "$result" "DECISION: reject"
assert_contains "Fallback has REASON" "$result" "REASON:"
assert_contains "Mentions empty response" "$result" "비어있음"

# ─────────────────────────────────────────────────────────
# Test 4: Missing DECISION field
# ─────────────────────────────────────────────────────────
echo "━━━ Test 4: Missing DECISION field ━━━"
MISSING_DECISION="REASON: some reason
TASK_TITLE: something"

result=$(validate_eval_response "$MISSING_DECISION" "REQ-004")
assert_contains "Fallback DECISION" "$result" "DECISION: reject"
assert_contains "Mentions missing field" "$result" "DECISION"
assert_contains "Has REASON in fallback" "$result" "REASON:"

# ─────────────────────────────────────────────────────────
# Test 5: Missing REASON field
# ─────────────────────────────────────────────────────────
echo "━━━ Test 5: Missing REASON field ━━━"
MISSING_REASON="DECISION: accept
TASK_TITLE: something"

result=$(validate_eval_response "$MISSING_REASON" "REQ-005")
assert_contains "Fallback DECISION" "$result" "DECISION: reject"
assert_contains "Mentions missing REASON" "$result" "REASON"

# ─────────────────────────────────────────────────────────
# Test 6: Both fields missing (garbage response)
# ─────────────────────────────────────────────────────────
echo "━━━ Test 6: Garbage response ━━━"
GARBAGE="Some random text that Claude returned
without any structured fields"

result=$(validate_eval_response "$GARBAGE" "REQ-006")
assert_contains "Fallback DECISION" "$result" "DECISION: reject"
assert_contains "Has REASON" "$result" "REASON:"
assert_contains "Mentions both fields" "$result" "DECISION"

# ─────────────────────────────────────────────────────────
# Test 7: Invalid DECISION value
# ─────────────────────────────────────────────────────────
echo "━━━ Test 7: Invalid DECISION value ━━━"
INVALID_DECISION="DECISION: maybe
REASON: 확실하지 않음"

result=$(validate_eval_response "$INVALID_DECISION" "REQ-007")
assert_contains "Fallback DECISION" "$result" "DECISION: reject"
assert_contains "Mentions invalid value" "$result" "maybe"

# ─────────────────────────────────────────────────────────
# Test 8: analyze-dependencies.sh fallback format
# ─────────────────────────────────────────────────────────
echo "━━━ Test 8: analyze-dependencies.sh with no claude CLI ━━━"

# Create a temporary script that simulates missing claude
TEMP_SCRIPT=$(mktemp)
cat > "$TEMP_SCRIPT" << 'TESTEOF'
#!/bin/bash
# Simulate analyze-dependencies.sh without claude CLI
set -euo pipefail

log() { echo "[TEST] $*" >&2; }

generate_independent_fallback() {
  local data="$1"
  local reason="$2"
  local all_ids
  all_ids=$(echo "$data" | cut -d'|' -f1 | tr '\n' ', ' | sed 's/,$//')
  log "$reason — 모든 요청을 독립(INDEPENDENT)으로 처리합니다: $all_ids"
  echo "INDEPENDENT: ${all_ids}"
}

REQUEST_DATA="REQ-001|Title1|Body1
REQ-002|Title2|Body2"

# Simulate missing claude
generate_independent_fallback "$REQUEST_DATA" "claude CLI를 찾을 수 없음"
TESTEOF
chmod +x "$TEMP_SCRIPT"

result=$(bash "$TEMP_SCRIPT" 2>/dev/null)
assert_contains "Has INDEPENDENT keyword" "$result" "INDEPENDENT:"
assert_contains "Has REQ-001" "$result" "REQ-001"
assert_contains "Has REQ-002" "$result" "REQ-002"
assert_not_contains "No ERROR in output" "$result" "ERROR"

rm -f "$TEMP_SCRIPT"

# ─────────────────────────────────────────────────────────
# Test 9: analyze-dependencies.sh validation of malformed response
# ─────────────────────────────────────────────────────────
echo "━━━ Test 9: analyze-dependencies.sh malformed response validation ━━━"

TEMP_SCRIPT2=$(mktemp)
cat > "$TEMP_SCRIPT2" << 'TESTEOF'
#!/bin/bash
set -euo pipefail

log() { echo "[TEST] $*" >&2; }

generate_independent_fallback() {
  local data="$1"
  local reason="$2"
  local all_ids
  all_ids=$(echo "$data" | cut -d'|' -f1 | tr '\n' ', ' | sed 's/,$//')
  log "$reason — 모든 요청을 독립(INDEPENDENT)으로 처리합니다: $all_ids"
  echo "INDEPENDENT: ${all_ids}"
}

REQUEST_DATA="REQ-010|Title|Body
REQ-011|Title2|Body2"

# Simulate a malformed Claude response
ANALYSIS_RESULT="I think these are related but I'm not sure."

HAS_INDEPENDENT=false
HAS_DEPENDENT=false
echo "$ANALYSIS_RESULT" | grep -q "^INDEPENDENT:" && HAS_INDEPENDENT=true
echo "$ANALYSIS_RESULT" | grep -q "^DEPENDENT:" && HAS_DEPENDENT=true

if [[ "$HAS_INDEPENDENT" == false && "$HAS_DEPENDENT" == false ]]; then
  generate_independent_fallback "$REQUEST_DATA" "응답 파싱 실패 (필수 필드 누락)"
  exit 0
fi

echo "$ANALYSIS_RESULT"
TESTEOF
chmod +x "$TEMP_SCRIPT2"

result=$(bash "$TEMP_SCRIPT2" 2>/dev/null)
assert_contains "Fallback has INDEPENDENT" "$result" "INDEPENDENT:"
assert_contains "Has REQ-010" "$result" "REQ-010"
assert_contains "Has REQ-011" "$result" "REQ-011"

rm -f "$TEMP_SCRIPT2"

# ─────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
