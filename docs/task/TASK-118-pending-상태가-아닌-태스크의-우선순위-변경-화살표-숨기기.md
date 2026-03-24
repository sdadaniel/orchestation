---
id: TASK-118
title: pending 상태가 아닌 태스크의 우선순위 변경 화살표 숨기기
status: in_progress
branch: task/task-118
worktree: ../repo-wt-task-118
priority: medium
scope:
  - src/frontend/src/components/**
  - src/frontend/src/app/tasks/**
created: 2026-03-24
updated: 2026-03-24
---
태스크 목록에서 우선순위 변경 화살표(위/아래)는 pending 상태의 태스크에만 표시되어야 한다. done, in_progress, cancelled 등 다른 상태에서는 화살표를 숨긴다.

## Completion Criteria
- pending 상태 태스크에만 우선순위 변경 화살표가 렌더링됨
- done, in_progress, cancelled 등 비-pending 상태 태스크에서는 화살표가 표시되지 않음
- 화살표 영역이 사라져도 레이아웃이 깨지지 않음
