#!/bin/bash
set -euo pipefail

# test-context-builder.sh — context-builder.sh 단위 테스트

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_TMP=$(mktemp -d)
trap 'rm -rf "$TEST_TMP"' EXIT

PASS=0
FAIL=0

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✅ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $desc"
    echo "     expected: $(echo "$expected" | head -3)"
    echo "     actual:   $(echo "$actual" | head -3)"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  ✅ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $desc (needle not found)"
    echo "     needle: $needle"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  ❌ $desc (needle found but should not be)"
    echo "     needle: $needle"
    FAIL=$((FAIL + 1))
  else
    echo "  ✅ $desc"
    PASS=$((PASS + 1))
  fi
}

# ── 테스트 환경 구성 ──────────────────────────────────────

# 가짜 repo 구조 생성
FAKE_REPO="$TEST_TMP/repo"
mkdir -p "$FAKE_REPO/docs/task"
mkdir -p "$FAKE_REPO/docs/requests"

# 완료된 태스크
cat > "$FAKE_REPO/docs/task/TASK-001-done-task.md" <<'EOF'
---
id: TASK-001
title: Done task
status: done
priority: high
---
Already done.
EOF

# 대기 중인 태스크
cat > "$FAKE_REPO/docs/task/TASK-002-pending-task.md" <<'EOF'
---
id: TASK-002
title: Pending task
status: pending
priority: medium
scope:
  - src/main.ts
  - src/utils.ts
branch: task/TASK-002
worktree: ../repo-wt-TASK-002
---
Do something.

## Completion Criteria
- 기능 구현
EOF

# 완료된 요청
cat > "$FAKE_REPO/docs/requests/REQ-001-done-req.md" <<'EOF'
---
id: REQ-001
title: Done request
status: done
priority: low
---
Old request.
EOF

# 워크트리 디렉토리 생성
FAKE_WT="$TEST_TMP/worktree"
mkdir -p "$FAKE_WT"

# ── context-builder.sh 로드 ──────────────────────────────

source "$REPO_ROOT/scripts/lib/context-builder.sh"

# ── 테스트 1: get_done_task_ids ──────────────────────────

echo ""
echo "📋 Test: get_done_task_ids"

done_ids=$(get_done_task_ids "$FAKE_REPO")
assert_contains "완료된 TASK-001 포함" "TASK-001-done-task.md" "$done_ids"
assert_contains "완료된 REQ-001 포함" "REQ-001-done-req.md" "$done_ids"
assert_not_contains "대기 중인 TASK-002 미포함" "TASK-002" "$done_ids"

# ── 테스트 2: embed_task_content ─────────────────────────

echo ""
echo "📋 Test: embed_task_content"

content=$(embed_task_content "$FAKE_REPO/docs/task/TASK-002-pending-task.md")
assert_contains "태스크 제목 포함" "Pending task" "$content"
assert_contains "완료 조건 포함" "Completion Criteria" "$content"

empty_content=$(embed_task_content "/nonexistent/file.md")
assert_eq "존재하지 않는 파일 → 빈 문자열" "" "$empty_content"

# ── 테스트 3: setup_context_filter ───────────────────────

echo ""
echo "📋 Test: setup_context_filter"

setup_context_filter "$FAKE_WT" "$FAKE_REPO"
assert_eq ".claudeignore 파일 생성됨" "0" "$([ -f "$FAKE_WT/.claudeignore" ] && echo 0 || echo 1)"

ignore_content=$(cat "$FAKE_WT/.claudeignore")
assert_contains "archive 디렉토리 제외" "docs/task/archive/" "$ignore_content"
assert_contains "node_modules 제외" "node_modules/" "$ignore_content"
assert_contains "완료된 TASK-001 제외" "TASK-001-done-task.md" "$ignore_content"
assert_contains "완료된 REQ-001 제외" "REQ-001-done-req.md" "$ignore_content"
assert_not_contains "대기 중인 TASK-002 미제외" "TASK-002" "$ignore_content"

# ── 테스트 4: build_task_prompt ──────────────────────────

echo ""
echo "📋 Test: build_task_prompt"

task_prompt=$(build_task_prompt "$FAKE_REPO/docs/task/TASK-002-pending-task.md" "TASK-002-pending-task.md" "src/main.ts
src/utils.ts" "")
assert_contains "작업 규칙 포함" "작업 규칙" "$task_prompt"
assert_contains "scope 포함" "src/main.ts" "$task_prompt"
assert_contains "태스크 내용 임베드됨" "Pending task" "$task_prompt"
assert_contains "완료 조건 임베드됨" "Completion Criteria" "$task_prompt"
assert_not_contains "파일 읽기 지시 없음" "해당 파일을 읽고" "$task_prompt"

# 피드백 포함 테스트
FEEDBACK_FILE="$TEST_TMP/feedback.txt"
echo "변수명을 수정하세요" > "$FEEDBACK_FILE"

task_prompt_with_feedback=$(build_task_prompt "$FAKE_REPO/docs/task/TASK-002-pending-task.md" "TASK-002-pending-task.md" "" "$FEEDBACK_FILE")
assert_contains "피드백 포함" "변수명을 수정하세요" "$task_prompt_with_feedback"

# ── 테스트 5: build_review_prompt ────────────────────────

echo ""
echo "📋 Test: build_review_prompt"

review_prompt=$(build_review_prompt "$FAKE_REPO/docs/task/TASK-002-pending-task.md" "TASK-002-pending-task.md")
assert_contains "리뷰 규칙 포함" "리뷰 규칙" "$review_prompt"
assert_contains "태스크 내용 임베드됨" "Completion Criteria" "$review_prompt"
assert_not_contains "파일 읽기 지시 없음 (1단계)" "을 읽고 완료 조건을 확인해라" "$review_prompt"
assert_contains "git diff 지시 포함" "git diff main" "$review_prompt"

# ── 결과 ──────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "결과: ✅ ${PASS} passed, ❌ ${FAIL} failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
