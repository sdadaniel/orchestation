---
id: TASK-201
title: 태스크 생성 시 큰 요청 자동 분할 로직 추가
status: done
branch: task/task-201
worktree: ../repo-wt-task-201
priority: high
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - scripts/auto-improve.sh
---

## 목표
auto-improve.sh의 evaluate_request()에서 요청이 너무 클 경우 여러 태스크로 분할하도록 개선한다.

## 현재 문제
- 요청 1개 → 태스크 1개로만 생성됨
- TASK-185처럼 독립적인 동선 4개가 하나의 태스크에 묶여 병목 발생
- scope 파일이 많거나 독립적인 작업 단위가 여러 개여도 분할하지 않음

## 변경 사항

### 1. eval 프롬프트 수정 (evaluate_request 함수)
- 판단 기준에 "요청이 독립적인 작업 단위 여러 개로 나뉘는가?" 추가
- 분할이 필요하면 `SPLIT: yes`와 함께 여러 TASK 블록을 출력하도록 지시
- 각 블록마다 `TASK_TITLE`, `TASK_DESCRIPTION`, `SCOPE`를 별도로 출력
- 분할 불필요 시 기존 형식 그대로 (하위 호환)

### 2. validate_eval_response 수정
- `SPLIT: yes` 응답일 때 여러 TASK 블록이 있는지 검증
- SPLIT인데 TASK 블록이 1개 이하면 fallback 처리

### 3. enrich/메인루프 수정
- SPLIT 응답이면 하나의 요청에서 여러 TASK 파일 생성
- 각 서브태스크는 독립적인 TASK-* 파일로 생성 (pending 상태)
- 원본 요청은 split 상태로 전환

## 분할 기준 (프롬프트에 포함할 내용)
- scope 파일이 서로 다른 페이지/모듈에 걸쳐 있고 독립적으로 작업 가능한 경우
- 체크리스트 항목이 서로 다른 기능 영역에 속하는 경우
- 하나의 태스크가 3개 이상의 독립적 동선을 포함하는 경우

## Completion Criteria
- evaluate_request 프롬프트에 분할 지시가 포함됨
- SPLIT 응답 파싱 및 검증 로직 동작
- 하나의 요청에서 여러 TASK 파일이 생성되는 흐름 동작
- 분할 불필요한 요청은 기존과 동일하게 동작 (하위 호환)
