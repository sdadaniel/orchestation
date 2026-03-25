---
id: TASK-139
title: 토스트 표시 시 페이지 새로고침 버그 수정
status: done
branch: task/task-139
worktree: ../repo-wt-task-139
priority: high
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/components/ui/toast.tsx
  - src/frontend/src/components/AppShell.tsx
---

## 현상
토스트 메시지가 뜰 때마다 페이지가 새로고침되는 것처럼 보임. 토스트가 상태 변경을 트리거하면서 전체 리렌더링이 발생하는 것으로 추정.

## 원인 조사 필요
- AppShell의 상태 변경 감지 로직(prevTaskStatusRef)이 토스트를 트리거할 때 다른 상태도 갱신하는지
- 토스트 컨텍스트의 상태 변경이 하위 컴포넌트 전체 리렌더링을 유발하는지
- useRequests/useTasks의 refetch가 토스트와 동시에 발생하면서 깜박임 유발하는지

## Completion Criteria
- 토스트 표시 시 페이지 깜박임/새로고침 없음
- 기존 토스트 기능 정상 동작
