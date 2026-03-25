#!/bin/bash
# common.sh — 공통 유틸리티 함수
# YAML frontmatter 파싱 등 여러 스크립트에서 공유하는 함수 모음

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
get_list() {
  awk -v key="$2" '
    NR==1 && /^---$/ { in_fm=1; next }
    in_fm && /^---$/ { exit }
    in_fm && $0 ~ "^"key":" { in_list=1; next }
    in_list && /^ +- / { sub(/^ +- /, ""); print; next }
    in_list && /^[^ ]/ { exit }
  ' "$1"
}
