#!/bin/bash
# model-selector.sh — 태스크 복잡도 기반 모델 선택
# 단순 태스크는 claude-haiku-4-5, 복잡한 태스크는 claude-sonnet-4-6 사용

# ── 기본 모델 설정 ──────────────────────────────────────
MODEL_SIMPLE="${MODEL_SIMPLE:-claude-haiku-4-5}"
MODEL_COMPLEX="${MODEL_COMPLEX:-claude-sonnet-4-6}"

# 기본값 상수 (환경변수 재설정 시 참조)
_MS_DEFAULT_SIMPLE="claude-haiku-4-5"
_MS_DEFAULT_COMPLEX="claude-sonnet-4-6"

# ── frontmatter 필드 읽기 ───────────────────────────────
_ms_get_field() {
  awk -v key="$2" '
    NR==1 && /^---$/ { in_fm=1; next }
    in_fm && /^---$/ { exit }
    in_fm && $0 ~ "^"key":" { sub("^"key":[ ]*", ""); print; exit }
  ' "$1"
}

# ── scope 라인 수 세기 ──────────────────────────────────
_ms_count_scope() {
  local task_file="$1"
  local count=0
  local in_frontmatter=false in_scope=false
  while IFS= read -r line; do
    if [[ "$line" == "---" ]]; then
      if $in_frontmatter; then break; fi
      in_frontmatter=true
      continue
    fi
    if ! $in_frontmatter; then continue; fi
    if [[ "$line" == "scope:" ]]; then
      in_scope=true
      continue
    fi
    if $in_scope; then
      if echo "$line" | grep -qE '^[[:space:]]*-[[:space:]]'; then
        count=$((count + 1))
      else
        break
      fi
    fi
  done < "$task_file"
  echo "$count"
}

# ── 복잡도 판정 (simple / complex) ──────────────────────
# 판정 기준:
#   1. frontmatter의 complexity 필드 (명시적 오버라이드, 최우선)
#      - "simple" | "low"  → simple
#      - "complex" | "high" → complex
#   2. 환경변수 MODEL_OVERRIDE → 해당 모델 직접 사용 (최우선 모델 오버라이드)
#   3. 휴리스틱 분류:
#      [simple 조건 - 모두 충족 시]
#        - scope 파일 수 ≤ 2
#        - 제목에 complex 키워드 없음
#        - 제목에 simple 키워드 있음 OR scope ≤ 1
#      [complex 조건 - 하나라도 충족 시]
#        - scope 파일 수 ≥ 4
#        - 제목/설명에 complex 키워드 포함
#      [그 외] → complex (안전 기본값)
determine_complexity() {
  local task_file="$1"

  # 1. frontmatter complexity 필드 (최우선)
  local complexity
  complexity=$(_ms_get_field "$task_file" "complexity")
  if [ -n "$complexity" ]; then
    case "$complexity" in
      simple|low)  echo "simple"; return ;;
      complex|high) echo "complex"; return ;;
      *)
        echo "⚠️  알 수 없는 complexity 값: $complexity → complex 기본값 사용" >&2
        echo "complex"; return ;;
    esac
  fi

  # 2. 휴리스틱 분류
  local title
  title=$(_ms_get_field "$task_file" "title")
  title=$(echo "$title" | tr '[:upper:]' '[:lower:]')

  local scope_count
  scope_count=$(_ms_count_scope "$task_file")

  # complex 키워드 (한국어/영어)
  local complex_keywords="리팩토링|리팩터링|refactor|신규 기능|new feature|아키텍처|architecture|마이그레이션|migration|다중 파일|multi.file|통합|integration|redesign|재설계|구현|implement|엔진|engine|파이프라인|pipeline|시스템|system"

  # simple 키워드 (한국어/영어)
  local simple_keywords="문서|docs|readme|오타|typo|설정|config|설정 변경|설정변경|주석|comment|버전|version|bump|rename|이름 변경|포맷|format|lint|cleanup|정리"

  local has_complex_keyword=false
  local has_simple_keyword=false

  if echo "$title" | grep -qiE "$complex_keywords"; then
    has_complex_keyword=true
  fi
  if echo "$title" | grep -qiE "$simple_keywords"; then
    has_simple_keyword=true
  fi

  # scope ≥ 4 → complex
  if [ "$scope_count" -ge 4 ]; then
    echo "complex"
    return
  fi

  # complex 키워드 → complex
  if $has_complex_keyword && ! $has_simple_keyword; then
    echo "complex"
    return
  fi

  # simple 키워드 + scope ≤ 2 → simple
  if $has_simple_keyword && [ "$scope_count" -le 2 ]; then
    echo "simple"
    return
  fi

  # scope ≤ 1 + no complex keyword → simple
  if [ "$scope_count" -le 1 ] && ! $has_complex_keyword; then
    echo "simple"
    return
  fi

  # 기본값: complex (안전)
  echo "complex"
}

# ── 모델 선택 ───────────────────────────────────────────
# 반환: 모델 이름 문자열
# 환경변수 MODEL_OVERRIDE가 설정되면 무조건 해당 모델 사용
select_model() {
  local task_file="$1"

  # 환경변수 오버라이드 (최우선)
  if [ -n "${MODEL_OVERRIDE:-}" ]; then
    echo "$MODEL_OVERRIDE"
    return
  fi

  local complexity
  complexity=$(determine_complexity "$task_file")

  local model_simple="${MODEL_SIMPLE:-$_MS_DEFAULT_SIMPLE}"
  local model_complex="${MODEL_COMPLEX:-$_MS_DEFAULT_COMPLEX}"

  case "$complexity" in
    simple) echo "$model_simple" ;;
    *)      echo "$model_complex" ;;
  esac
}

# ── 모델 선택 로그 출력 ─────────────────────────────────
# 선택된 모델과 판정 근거를 로그에 출력
log_model_selection() {
  local task_file="$1"
  local task_id="$2"
  local token_log="$3"

  local complexity
  complexity=$(determine_complexity "$task_file")
  local model
  model=$(select_model "$task_file")

  local override_info=""
  if [ -n "${MODEL_OVERRIDE:-}" ]; then
    override_info=" (MODEL_OVERRIDE)"
  fi

  local fm_complexity
  fm_complexity=$(_ms_get_field "$task_file" "complexity")
  local source_info="heuristic"
  if [ -n "$fm_complexity" ]; then
    source_info="frontmatter(complexity=${fm_complexity})"
  fi

  local scope_count
  scope_count=$(_ms_count_scope "$task_file")

  echo "🤖 모델 선택: ${model}${override_info} (complexity=${complexity}, source=${source_info}, scope_files=${scope_count})"

  # 토큰 로그에도 기록
  if [ -n "$token_log" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${task_id} | model_selection | model=${model} | complexity=${complexity} | source=${source_info} | scope_files=${scope_count}${override_info}" >> "$token_log"
  fi
}
