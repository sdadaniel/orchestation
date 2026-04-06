---
id: TASK-351
title: validPriorities-매직-배열-중복-정의-상수-추출
status: pending
priority: medium
mode: night
created: 2026-04-06
updated: 2026-04-06
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/route.ts
  - src/frontend/src/app/api/tasks/[id]/route.ts
  - src/frontend/src/app/api/requests/route.ts
  - src/frontend/src/lib/constants.ts
---
`const validPriorities = ["critical", "high", "medium", "low"]` 배열이 API 라우트 3곳에서 중복 정의되어 있다.

- `src/frontend/src/app/api/tasks/route.ts:71`
- `src/frontend/src/app/api/tasks/[id]/route.ts:54`
- `src/frontend/src/app/api/requests/route.ts:84` (여기는 `"critical"` 누락 — 불일치)

`src/frontend/src/lib/constants.ts`에 `VALID_PRIORITIES` 상수로 추출하고, 3곳에서 import하여 사용한다. requests/route.ts의 critical 누락도 의도적인지 확인 후 통일한다.

## Completion Criteria
- `VALID_PRIORITIES` 상수가 `src/frontend/src/lib/constants.ts`에 정의됨
- 3개 API 라우트에서 로컬 `validPriorities` 배열 대신 import된 상수 사용
- requests/route.ts의 priority 목록이 tasks 라우트와 일치
- TypeScript 타입 체크 통과
