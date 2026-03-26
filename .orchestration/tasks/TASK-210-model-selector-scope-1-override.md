---
id: TASK-210
title: model-selector scope ≤ 1일 때 키워드 무시하고 simple 강제
status: in_progress
branch: task/task-210
worktree: ../repo-wt-task-210
priority: high
created: 2026-03-26
depends_on: []
scope:
  - scripts/lib/model-selector.sh
---

## 현상

scope_files=1인 태스크(TASK-169)가 제목에 "통합"(complex 키워드)이 포함되어 sonnet으로 실행됨.
실제로는 파일 1개 수정으로 haiku 1턴이면 끝날 작업인데 sonnet 24턴, $1.11 소비.

## 근본 원인

model-selector.sh의 휴리스틱 로직:
- scope ≥ 4 → complex (OK)
- complex 키워드 있으면 → complex (문제: scope 1개인데도 complex)
- scope ≤ 1 + no complex keyword → simple

"통합", "구현", "시스템" 같은 키워드가 scope 1개짜리 단순 태스크 제목에도 자주 등장하여 과분류 발생.

## 완료 조건

1. scope_files ≤ 1이면 키워드와 무관하게 simple로 판정
2. scope_files = 2이면 complex 키워드가 있어도 simple 유지 (단, "리팩토링", "아키텍처", "마이그레이션" 같은 고비용 키워드는 예외)
3. 기존 scope ≥ 4 → complex 규칙은 유지
4. 변경 후 TASK-169 같은 케이스가 simple로 판정되는지 로그 확인
