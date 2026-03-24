---
id: TASK-098
title: auto-improve.sh 배열 확장 문법 표준화
status: in_progress
priority: high
sprint:
depends_on: [TASK-097]
branch: task/TASK-098-auto-improvesh----
worktree: ../repo-wt-TASK-098
role: general
reviewer_role: reviewer-general
---

# TASK-098: auto-improve.sh 배열 확장 문법 표준화

## 원본 요청

- Request: REQ-020
- 제목: auto-improve 배열 확장 문법 수정
- 내용: auto-improve.sh에서 비표준 bash 배열 확장 문법 사용으로 빈 배열에서 예측 불가 동작 발생.

## 문제
- `scripts/auto-improve.sh:311, 400, 407, 429`
- `"${ARRAY[@]+"${ARRAY[@]}"}"` 비표준 패턴 사용
- 빈 배열에서 word-splitting 이슈 발생 가능

## Completion Criteria
- 배열 길이 체크 후 반복 또는 표준 패턴으로 교체
- 빈 배열, 단일 요소, 다수 요소 모두 정상 동작

## 완료 조건

- `scripts/auto-improve.sh` 311, 400, 407, 429번 라인의 `"${ARRAY[@]+"${ARRAY[@]}"}"` 패턴을 배열 길이 체크(`${#ARRAY[@]} -gt 0`) 또는 표준 패턴으로 교체
- 빈 배열, 단일 요소, 다수 요소 모두 정상 동작 확인
- 수정 후 set -u 환경에서 unbound variable 오류 없음 확인
