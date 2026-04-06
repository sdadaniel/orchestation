---
id: TASK-346
title: usePlanTree-배열-인덱스-접근-타입-안전성-추가
status: pending
priority: medium
mode: night
created: 2026-04-06
updated: 2026-04-06
depends_on: []
scope:
  - src/frontend/src/hooks/usePlanTree.ts
---
`usePlanTree.ts`의 `fetchPlanTree` 함수에서 `plans[0]`를 `buildPlanTree`에 직접 전달하고 있다.
`plans.length === 0` 체크로 런타임에는 안전하나, `noUncheckedIndexedAccess` strict 옵션 하에서
`plans[0]`의 타입이 `PlanFrontmatter | undefined`로 추론되어 타입 에러가 발생한다.

배열 인덱스 접근 후 명시적 null 체크 또는 non-null assertion 대신 지역 변수에 할당하여 타입 가드를 적용해야 한다.

## Completion Criteria
- `plans[0]`를 지역 변수에 할당하고 `undefined` 체크 후 `buildPlanTree`에 전달
- `npx tsc --noEmit --noUncheckedIndexedAccess` 기준 해당 파일 에러 0건
- 기존 동작 변경 없음
