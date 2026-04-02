---
id: TASK-304
title: CostTable phase 옵셔널 타입 안전성 수정
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:  []
---

`CostEntry.phase`가 `string | undefined`인데 `CostTable.tsx`에서 `.localeCompare()`를 바로 호출하여 타입 에러가 발생합니다.

---
id: TASK-304
title: CostTable phase 옵셔널 타입 안전성 수정
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:
  - src/frontend/src/components/cost/CostTable.tsx
---
`CostEntry.phase`가 `string | undefined`(옵셔널)인데, `CostTable.tsx:41`의 COMPARATORS에서 `a.phase.localeCompare(b.phase)`를 직접 호출하여 strict 모드에서 TS18048/TS2769 타입 에러 발생.

`(a.phase ?? "").localeCompare(b.phase ?? "")` 형태로 fallback 처리하여 타입 안전성 확보.

## Completion Criteria
- `npx tsc --noEmit --strict` 실행 시 `CostTable.tsx` 관련 에러 0건
- 기존 정렬 동작 변경 없음

## Completion Criteria


