---
id: TASK-011
title: 상태별 색상 및 스타일 상수 정의
sprint: SPRINT-002
status: done
priority: high
depends_on: []
blocks:
  - TASK-013
  - TASK-014
parallel_with:
  - TASK-009
  - TASK-010
role: frontend-dev
branch: task/TASK-011-status-styles
worktree: ../repo-wt-TASK-011
reviewer_role: reviewer-general
affected_files:
  - src/frontend/lib/constants.ts
---

## 목표

Task 상태별 색상, 우선순위별 스타일 등 워터폴 뷰에서 사용할 디자인 상수를 정의한다.

## 무엇을

- `src/frontend/lib/constants.ts`

## 어떻게

- Tailwind CSS 클래스 기반 상수 정의
- 상태별 색상:
  - `backlog`: 회색 (`bg-gray-500`)
  - `in_progress`: 파랑 (`bg-blue-500`)
  - `in_review`: 주황 (`bg-orange-500`)
  - `done`: 초록 (`bg-green-500`)
- 우선순위별 표시:
  - `critical`: 빨강 뱃지
  - `high`: 주황 뱃지
  - `medium`: 파랑 뱃지
  - `low`: 회색 뱃지

## 입출력

- 입력: status 또는 priority 문자열
- 출력: 해당 Tailwind 클래스 문자열

## 완료 조건

- 상태 4종, 우선순위 4종의 스타일 상수가 정의됨
- 타입 안전하게 사용 가능 (문자열 리터럴 타입)
