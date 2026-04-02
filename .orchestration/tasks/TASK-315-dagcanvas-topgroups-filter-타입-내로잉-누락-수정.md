---
id: TASK-315
title: DAGCanvas-topGroups-filter-타입-내로잉-누락-수정
status: rejected
branch: task/task-315
worktree: ../repo-wt-task-315
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 17:27
depends_on: []
scope:
  - src/frontend/src/components/DAGCanvas.tsx
---
`topGroups`를 `.filter((g) => g.box !== null)`로 필터링하지만, TypeScript가 타입을 좁히지 못해 JSX에서 `g.box!` non-null assertion을 8회 반복 사용 중.

타입 가드 predicate `.filter((g): g is ... => g.box !== null)`을 적용하여 `!` 단언을 모두 제거한다.

## Completion Criteria
- `DAGCanvas.tsx`에서 `topGroups` filter에 타입 predicate 적용
- `g.box!` non-null assertion 전부 제거 (8건)
- `npx tsc --noEmit` 통과
