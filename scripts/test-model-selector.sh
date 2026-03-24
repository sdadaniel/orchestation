#!/bin/bash
set -euo pipefail

# test-model-selector.sh — model-selector.sh 단위 테스트
# Usage: ./scripts/test-model-selector.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/model-selector.sh"

TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

PASS=0
FAIL=0

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✅ $label: $actual"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label: expected=$expected actual=$actual"
    FAIL=$((FAIL + 1))
  fi
}

# ── Helper: 임시 태스크 파일 생성 ─────────────────────────
make_task() {
  local name="$1"
  shift
  local file="$TMPDIR_TEST/${name}.md"
  cat > "$file" <<EOF
---
$@
---
본문 내용
EOF
  echo "$file"
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 model-selector.sh 테스트"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. frontmatter complexity 필드 테스트 ─────────────────
echo ""
echo "📋 1. frontmatter complexity 필드 오버라이드"

f=$(make_task "t1" "id: TASK-001
title: 테스트
complexity: simple")
assert_eq "complexity=simple → simple" "simple" "$(determine_complexity "$f")"

f=$(make_task "t2" "id: TASK-002
title: 테스트
complexity: complex")
assert_eq "complexity=complex → complex" "complex" "$(determine_complexity "$f")"

f=$(make_task "t3" "id: TASK-003
title: 테스트
complexity: low")
assert_eq "complexity=low → simple" "simple" "$(determine_complexity "$f")"

f=$(make_task "t4" "id: TASK-004
title: 테스트
complexity: high")
assert_eq "complexity=high → complex" "complex" "$(determine_complexity "$f")"

# ── 2. 키워드 기반 휴리스틱 테스트 ────────────────────────
echo ""
echo "📋 2. 키워드 기반 휴리스틱"

f=$(make_task "t5" "id: TASK-005
title: README 문서 업데이트")
assert_eq "문서 업데이트 → simple" "simple" "$(determine_complexity "$f")"

f=$(make_task "t6" "id: TASK-006
title: 설정 변경")
assert_eq "설정 변경 → simple" "simple" "$(determine_complexity "$f")"

f=$(make_task "t7" "id: TASK-007
title: 리팩토링 및 아키텍처 개선")
assert_eq "리팩토링 → complex" "complex" "$(determine_complexity "$f")"

f=$(make_task "t8" "id: TASK-008
title: 신규 기능 구현")
assert_eq "신규 기능 구현 → complex" "complex" "$(determine_complexity "$f")"

# ── 3. scope 기반 휴리스틱 테스트 ─────────────────────────
echo ""
echo "📋 3. scope 파일 수 기반 휴리스틱"

f=$(make_task "t9" "id: TASK-009
title: 버그 수정
scope:
  - src/a.ts
  - src/b.ts
  - src/c.ts
  - src/d.ts")
assert_eq "scope=4 → complex" "complex" "$(determine_complexity "$f")"

f=$(make_task "t10" "id: TASK-010
title: 버그 수정
scope:
  - src/a.ts")
assert_eq "scope=1 + 일반 제목 → simple" "simple" "$(determine_complexity "$f")"

# ── 4. 모델 선택 테스트 ──────────────────────────────────
echo ""
echo "📋 4. select_model 함수"

f=$(make_task "t11" "id: TASK-011
title: 오타 수정")
assert_eq "simple → haiku" "claude-haiku-4-5" "$(select_model "$f")"

f=$(make_task "t12" "id: TASK-012
title: 시스템 리팩토링
scope:
  - src/a.ts
  - src/b.ts
  - src/c.ts
  - src/d.ts
  - src/e.ts")
assert_eq "complex → sonnet" "claude-sonnet-4-6" "$(select_model "$f")"

# ── 5. MODEL_OVERRIDE 환경변수 테스트 ────────────────────
echo ""
echo "📋 5. MODEL_OVERRIDE 환경변수"

f=$(make_task "t13" "id: TASK-013
title: 오타 수정
complexity: simple")
MODEL_OVERRIDE="claude-opus-4" result=$(select_model "$f")
unset MODEL_OVERRIDE
assert_eq "MODEL_OVERRIDE → 강제 적용" "claude-opus-4" "$result"

# ── 6. MODEL_SIMPLE / MODEL_COMPLEX 환경변수 테스트 ──────
echo ""
echo "📋 6. MODEL_SIMPLE/MODEL_COMPLEX 커스텀"

f=$(make_task "t14" "id: TASK-014
title: 문서 수정")
result=$(MODEL_SIMPLE="custom-haiku" select_model "$f")
assert_eq "MODEL_SIMPLE 커스텀" "custom-haiku" "$result"

f=$(make_task "t15" "id: TASK-015
title: 시스템 구현
scope:
  - src/a.ts
  - src/b.ts
  - src/c.ts
  - src/d.ts")
result=$(MODEL_COMPLEX="custom-sonnet" select_model "$f")
assert_eq "MODEL_COMPLEX 커스텀" "custom-sonnet" "$result"

# ── 7. log_model_selection 테스트 ────────────────────────
echo ""
echo "📋 7. log_model_selection 로그 출력"

f=$(make_task "t16" "id: TASK-016
title: config 설정 변경")
log_file="$TMPDIR_TEST/token-usage.log"
log_model_selection "$f" "TASK-016" "$log_file"
if grep -q "TASK-016.*model_selection.*complexity=simple" "$log_file"; then
  echo "  ✅ 토큰 로그에 모델 선택 기록됨"
  PASS=$((PASS + 1))
else
  echo "  ❌ 토큰 로그 기록 실패"
  FAIL=$((FAIL + 1))
fi

# ── 결과 ─────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 결과: ✅ ${PASS} passed, ❌ ${FAIL} failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
echo "🎉 모든 테스트 통과!"
