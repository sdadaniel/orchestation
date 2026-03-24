---
id: TASK-105
title: CostTable 기본 정렬을 시간순으로 변경하고 컬럼 헤더 정렬 토글 구현
status: in_progress
priority: medium
sort_order: 4
sprint:
depends_on: [TASK-104]
branch: task/TASK-105-costtable---------
worktree: ../repo-wt-TASK-105
role: general
reviewer_role: reviewer-general
updated: 2026-03-24 09:23:17
---
# TASK-105: CostTable 기본 정렬을 시간순으로 변경하고 컬럼 헤더 정렬 토글 구현

## 원본 요청

- Request: REQ-035
- 제목: Cost 테이블 시간순 정렬 및 정렬 토글
- 내용: CostTable이 현재 비용 높은 순으로만 정렬된다. 기본 정렬을 시간순(최신 먼저)으로 변경하고, 컬럼 헤더 클릭 시 정렬 기준을 토글할 수 있도록 개선한다. (Cost, Time, Tokens 등)

## 완료 조건

- CostTable의 기본 정렬 기준을 시간순(최신 먼저, timestamp desc)으로 변경
- Cost, Time, Tokens 컬럼 헤더 클릭 시 해당 컬럼 기준으로 정렬 전환
- 동일 컬럼 재클릭 시 오름차순/내림차순 토글
- 현재 정렬 컬럼과 방향을 헤더에 시각적으로 표시 (화살표 아이콘 등)
- 정렬 상태는 컴포넌트 로컬 state로 관리 (외부 의존 없음)

## 실패 사유 (2026-03-24 17:57)

Not logged in · Please run /login

## 실패 사유 (2026-03-24 18:22)

Not logged in · Please run /login
