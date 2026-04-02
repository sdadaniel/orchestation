---
id: TASK-298
title: 테스트 파일 CostEntry 타입 누락 필드 추가
status: in_progress
branch: task/task-298
worktree: ../repo-wt-task-298
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 15:25
depends_on: []
scope:  []
---

The test files are missing `timestamp`, `taskId`, `turns`, `durationMs` fields. The scope files:

- `src/frontend/src/lib/cost-aggregation.test.ts`
- `src/frontend/src/lib/cost-phase.test.ts`

---
id: TASK-298
title: 테스트 파일 CostEntry 타입 누락 필드 추가
status: in_progress
branch: task/task-298
worktree: ../repo-wt-task-298
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 15:25
depends_on: []
scope:
  - src/frontend/src/lib/cost-aggregation.test.ts
  - src/frontend/src/lib/cost-phase.test.ts
---
`CostEntry` 인터페이스에 `timestamp`, `taskId`, `turns`, `durationMs` 필드가 추가되었으나, 테스트 파일의 객체 리터럴에 해당 필드가 누락되어 strict 모드에서 TS2739 에러 발생 (총 26건).

각 테스트의 `CostEntry` 객체에 누락된 4개 필드를 기본값으로 추가한다.

## Completion Criteria
- `npx tsc --noEmit` 실행 시 `cost-aggregation.test.ts`, `cost-phase.test.ts` 관련 에러 0건
- 기존 테스트 로직 변경 없음

## Completion Criteria


