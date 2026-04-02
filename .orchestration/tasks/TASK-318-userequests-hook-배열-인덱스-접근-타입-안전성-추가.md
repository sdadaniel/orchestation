---
id: TASK-318
title: useRequests-hook-배열-인덱스-접근-타입-안전성-추가
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:
  - src/frontend/src/hooks/useRequests.ts
---
`useRequests.ts` 127–128행에서 `siblings[swapSibIdx]`의 결과(`other`)가 `undefined`일 수 있음에도 타입 가드 없이 프로퍼티에 접근하고 있다. (`noUncheckedIndexedAccess` strict 기준 TS18048)

bounds check(123행)가 존재하지만 TypeScript는 이를 인식하지 못하므로, `other`에 대해 명시적 `undefined` 체크 또는 non-null assertion을 추가해야 한다.

## Completion Criteria
- `other` 변수 사용 전에 `if (!other) return prev;` 가드 추가
- `npx tsc --noEmit --strict --noUncheckedIndexedAccess` 실행 시 해당 파일의 TS18048 에러 0건
