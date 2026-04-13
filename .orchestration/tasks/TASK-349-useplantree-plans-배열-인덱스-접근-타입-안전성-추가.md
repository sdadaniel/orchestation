---
id: TASK-349
title: usePlanTree-plans-배열-인덱스-접근-타입-안전성-추가
status: failed
branch: task/task-349
worktree: ../repo-wt-task-349
priority: medium
mode: night
created: 2026-04-06T00:00:00.000Z
updated: '2026-04-13 00:00'
depends_on: []
scope:
  - src/frontend/src/hooks/usePlanTree.ts
---
`usePlanTree.ts` 37번째 줄에서 `plans[0]`을 `buildPlanTree`에 직접 전달하고 있다. `plans.length === 0` 체크가 있지만 TypeScript `noUncheckedIndexedAccess` strict 모드에서는 배열 인덱스 접근이 `T | undefined`를 반환하므로 타입 에러가 발생한다.

`plans[0]`을 별도 변수에 할당 후 `undefined` 체크를 추가하거나, non-null assertion 대신 명시적 guard를 사용하여 타입 안전성을 확보해야 한다.

## Completion Criteria
- `npx tsc --noEmit --strict --noUncheckedIndexedAccess` 실행 시 `src/hooks/usePlanTree.ts` 관련 에러가 0건일 것
- 기존 동작(plans가 빈 배열이면 null 반환)이 변경되지 않을 것
