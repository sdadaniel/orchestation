---
id: TASK-302
title: CostTable phase 옵셔널 필드 타입 안전성 수정
status: rejected
branch: task/task-302
worktree: ../repo-wt-task-302
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 15:42
depends_on: []
scope:  []
---

`phase` is optional (`phase?: string`) in the CostEntry type used by CostTable. Line 41 does `a.phase.localeCompare(b.phase)` without null checks — a clear TS error.

---
id: TASK-302
title: CostTable phase 옵셔널 필드 타입 안전성 수정
status: rejected
branch: task/task-302
worktree: ../repo-wt-task-302
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 15:42
depends_on: []
scope:
  - src/frontend/src/components/cost/CostTable.tsx
---
`CostEntry.phase`가 옵셔널(`phase?: string`)인데 `CostTable.tsx:41`에서 null 체크 없이 `a.phase.localeCompare(b.phase)`를 호출하여 TypeScript 컴파일 에러(TS18048, TS2769) 발생.

## Completion Criteria
- `COMPARATORS.phase` 비교 함수에서 `a.phase`, `b.phase`가 `undefined`일 경우를 처리하여 TS 에러 해소
- `npx tsc --noEmit` 실행 시 `CostTable.tsx` 관련 에러 0건

## Completion Criteria


