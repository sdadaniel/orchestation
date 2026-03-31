#!/bin/bash
# common.sh — 공통 유틸리티 함수
# YAML frontmatter 파싱, 템플릿 렌더링 등 여러 스크립트에서 공유하는 함수 모음

# ── 패키지 디렉토리 + 템플릿 디렉토리 ──
# PACKAGE_DIR가 이미 설정되어 있으면 사용, 아니면 common.sh 위치 기준으로 resolve
PACKAGE_DIR="${PACKAGE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TEMPLATE_DIR="$PACKAGE_DIR/template"

# ── 템플릿 경로 해석 (override 우선) ─────────────────
# 탐색 순서:
#   1. .orchestration/template/<path>  (사용자 프로젝트 오버라이드)
#   2. <패키지>/template/<path>        (패키지 기본값)
# 인자: $1=template/ 기준 상대 경로 (예: "prompt/worker-task.md")
# 출력: 실제 파일의 절대 경로
resolve_template() {
  local tpl_path="$1"

  # PROJECT_ROOT가 설정되어 있으면 프로젝트 오버라이드 먼저 확인
  if [ -n "${PROJECT_ROOT:-}" ] && [ -f "$PROJECT_ROOT/.orchestration/template/$tpl_path" ]; then
    echo "$PROJECT_ROOT/.orchestration/template/$tpl_path"
    return
  fi

  # 패키지 기본 템플릿
  echo "$TEMPLATE_DIR/$tpl_path"
}

# ── 템플릿 파일 읽기 + 변수 치환 ─────────────────────
# 인자: $1=template/ 기준 상대 경로 (예: "prompt/worker-task.md")
#       나머지 인자: KEY=VALUE 쌍 (예: task_filename="TASK-001.md" task_content="...")
# 출력: 치환된 내용을 stdout으로 출력
#
# 멀티라인 value 지원: python을 사용하여 안전하게 치환
render_template() {
  local tpl_path="$1"
  shift

  local resolved
  resolved=$(resolve_template "$tpl_path")

  local content
  content=$(cat "$resolved")

  # python3이 있으면 안전한 멀티라인 치환, 없으면 단순 bash 치환
  if command -v python3 &>/dev/null; then
    local py_script='
import sys
content = sys.stdin.read()
for arg in sys.argv[1:]:
    eq = arg.index("=")
    key = "{{" + arg[:eq] + "}}"
    val = arg[eq+1:]
    content = content.replace(key, val)
sys.stdout.write(content)
'
    echo "$content" | python3 -c "$py_script" "$@"
  else
    # fallback: bash 내장 치환 (줄바꿈 포함 값은 깨질 수 있음)
    for pair in "$@"; do
      local key="${pair%%=*}"
      local value="${pair#*=}"
      content="${content//\{\{${key}\}\}/${value}}"
    done
    echo "$content"
  fi
}

# ── YAML frontmatter 필드 읽기 ─────────────────────────
# 인자: $1=파일경로, $2=필드명
# 출력: 해당 필드의 값 (없으면 빈 문자열)
get_field() {
  awk -v key="$2" '
    NR==1 && /^---$/ { in_fm=1; next }
    in_fm && /^---$/ { exit }
    in_fm && $0 ~ "^"key":" { sub("^"key":[ ]*", ""); print; exit }
  ' "$1"
}

# ── YAML frontmatter 리스트 필드 읽기 ──────────────────
# 인자: $1=파일경로, $2=필드명
# 출력: 리스트 항목을 한 줄씩 출력
# 지원 형식:
#   depends_on: [TASK-001, TASK-002]   (인라인 배열)
#   depends_on:                         (YAML 리스트)
#     - TASK-001
#     - TASK-002
get_list() {
  awk -v key="$2" '
    NR==1 && /^---$/ { in_fm=1; next }
    in_fm && /^---$/ { exit }
    in_fm && $0 ~ "^"key":" {
      # 인라인 배열 체크: depends_on: [TASK-001, TASK-002]
      if ($0 ~ /\[.+\]/) {
        val = $0
        sub(/.*\[/, "", val)
        sub(/\].*/, "", val)
        n = split(val, items, ",")
        for (i = 1; i <= n; i++) {
          gsub(/^[ ]+|[ ]+$/, "", items[i])
          if (items[i] != "") print items[i]
        }
        exit
      }
      # 인라인 빈 배열: depends_on: []
      if ($0 ~ /\[\]/) exit
      in_list=1; next
    }
    in_list && /^ +- / { sub(/^ +- /, ""); print; next }
    in_list && /^[^ ]/ { exit }
  ' "$1"
}
