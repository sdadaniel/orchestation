---
id: TASK-183
title: Run/Stop 버튼을 Tasks 헤더에서 상단바 Running 영역으로 이동
status: done
branch: task/task-183
worktree: ../repo-wt-task-183
priority: high
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/components/AppShell.tsx
  - src/frontend/src/components/RunningIndicator.tsx
  - src/frontend/src/components/AutoImproveControl.tsx
  - src/frontend/src/app/tasks/page.tsx
---

## 현상
- Run/Stop 버튼이 Tasks 페이지 헤더(Tasks 제목 옆)에 있음
- 상단바에 Running 인디케이터가 따로 있어서 역할이 분리됨
- Run/Stop은 전역 동작이므로 상단바에 있는 게 자연스러움

## 수정 방향
- AutoImproveControl(Run/Stop)을 Tasks 헤더에서 제거
- 상단바의 RunningIndicator 옆 또는 통합하여 Run/Stop 배치
- 어느 페이지에서든 Run/Stop 접근 가능

## Completion Criteria
- 상단바에서 Run/Stop 가능
- Tasks 페이지 헤더에서 Run/Stop 제거
- 기존 기능 정상 동작
