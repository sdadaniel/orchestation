---
id: TASK-301
title: CostTable phase 옵셔널 타입 안전성 수정
status: done
branch: task/task-301
worktree: ../repo-wt-task-301
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 15:39
depends_on: []
scope:  []
---

`CostEntry.phase`가 `string | undefined`인데 `CostTable.tsx:41`에서 null check 없이 `.localeCompare()` 호출하는 타입 에러입니다.

---
id: TASK-301
title: CostTable phase 옵셔널 타입 안전성 수정
status: done
branch: task/task-301
worktree: ../repo-wt-task-301
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 15:39
depends_on: []
scope:
  - src/frontend/src/components/cost/CostTable.tsx
---
`CostEntry.phase`가 `string | undefined` 타입인데, `CostTable.tsx:41`의 COMPARATORS에서 `a.phase.localeCompare(b.phase)`로 null check 없이 직접 호출하여 strict 모드에서 TS18048/TS2769 에러 발생.

`(a.phase ?? "").localeCompare(b.phase ?? "")` 형태로 옵셔널 처리 필요.

## Completion Criteria
- `npx tsc --noEmit --strict` 실행 시 `CostTable.tsx`의 phase 관련 TS18048, TS2769 에러가 0건

## Completion Criteria


