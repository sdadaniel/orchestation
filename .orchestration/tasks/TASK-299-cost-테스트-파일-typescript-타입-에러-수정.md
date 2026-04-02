---
id: TASK-299
title: cost 테스트 파일 TypeScript 타입 에러 수정
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:
  - src/frontend/src/lib/cost-aggregation.test.ts
  - src/frontend/src/lib/cost-phase.test.ts
---
`CostEntry` 타입에 `timestamp`, `taskId`, `turns`, `durationMs` 필드가 추가되었으나, 테스트 파일의 mock 데이터가 업데이트되지 않아 17건의 TS2739 타입 에러 발생.

각 테스트의 `CostEntry` 리터럴에 누락된 필드를 추가하여 타입 체크를 통과시킨다.

## Completion Criteria
- `npx tsc --noEmit` 실행 시 `cost-aggregation.test.ts`, `cost-phase.test.ts` 관련 에러 0건
