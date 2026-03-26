---
id: TASK-219
title: fix-noUncheckedIndexedAccess-notices-route
status: done
branch: task/task-219
worktree: ../repo-wt-task-219
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/app/api/notices/route.ts
---
`src/frontend/src/app/api/notices/route.ts` 37번 줄에서 `m[1]`이 `string | undefined` 타입으로 추론되어 `parseInt`의 `string` 파라미터에 할당 불가 (TS2345). regex match 후 `m`이 truthy일 때 `m[1]`은 항상 존재하므로 non-null assertion(`m[1]!`) 추가로 해결.

## Completion Criteria
- `npx tsc --noEmit --strict --noUncheckedIndexedAccess` 실행 시 `src/app/api/notices/route.ts(37)` 에러가 사라질 것
- 기존 로직 변경 없이 타입 단언만 추가
