---
id: TASK-228
title: "cost-parser non-null assertion을 안전한 타입 가드로 교체"
status: failed
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/lib/cost-parser.ts
---
`aggregateByTask` 함수에서 `Map.get()` 반환값에 non-null assertion(`!`)을 사용 중.
- 137행: `modelsMap.get(e.taskId)!.add(e.model)`
- 153행: `const models = modelsMap.get(taskId)!`

strict null checks 하에서 `Map.get()`은 `T | undefined`를 반환하므로 `!` 대신 안전한 타입 가드 또는 변수 재사용 패턴으로 교체 필요.

## Completion Criteria
- `cost-parser.ts`에서 non-null assertion(`!`) 제거
- 런타임 동작 변경 없이 타입 안전성 확보
- `npm run build` 통과
