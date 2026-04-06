---
id: TASK-352
title: usePlanTree-배열-인덱스-타입-안전성-추가
status: pending
priority: medium
mode: night
created: 2026-04-06
updated: 2026-04-06
depends_on: []
scope:
  - src/frontend/src/hooks/usePlanTree.ts
---
`usePlanTree.ts`에서 `plans[0]`을 `buildPlanTree`에 전달할 때 `noUncheckedIndexedAccess` strict 옵션 기준으로 `PlanFrontmatter | undefined` 타입이 `PlanFrontmatter`에 할당 불가능한 타입 에러 발생.

`plans.length === 0` 체크가 있지만 TypeScript가 배열 인덱스 접근의 narrowing을 추론하지 못함. 명시적 변수 할당 + undefined 체크로 수정 필요.

## Completion Criteria
- `npx tsc --noEmit --strict --noUncheckedIndexedAccess` 실행 시 `usePlanTree.ts` 관련 에러 0건
- 기존 동작 변경 없음
