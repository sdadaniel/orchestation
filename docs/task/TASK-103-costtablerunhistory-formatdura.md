---
id: TASK-103
title: CostTable/RunHistory formatDuration 공통 유틸로 추출
status: in_progress
priority: low
sprint:
depends_on: []
branch: task/TASK-103-costtablerunhistory-formatdura
worktree: ../repo-wt-TASK-103
role: general
reviewer_role: reviewer-general
---

# TASK-103: CostTable/RunHistory formatDuration 공통 유틸로 추출

## 원본 요청

- Request: REQ-040
- 제목: CostTable/RunHistory의 formatDuration 중복 제거
- 내용: CostTable.tsx와 RunHistory.tsx에 동일한 formatDuration 함수가 중복 정의되어 있다. 공통 유틸로 추출하여 중복을 제거한다.

## 완료 조건

- `src/frontend/src/components/CostTable.tsx`의 `formatDuration` 함수 확인
- `src/frontend/src/components/RunHistory.tsx`의 `formatDuration` 함수 확인
- 두 함수가 동일한 로직인지 검증
- `src/frontend/src/lib/format-utils.ts` (또는 적절한 위치)에 `formatDuration` 공통 함수 추출
- `CostTable.tsx`, `RunHistory.tsx`에서 중복 정의 제거 후 공통 함수 import
- 기존 동작이 변경되지 않음을 확인

## 실패 사유 (2026-03-24 17:57)

Not logged in · Please run /login
