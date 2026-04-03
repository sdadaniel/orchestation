---
id: TASK-329
title: monitor-route-배열-인덱스-타입-안전성-추가
status: pending
priority: medium
mode: night
created: 2026-04-03
updated: 2026-04-03
depends_on: []
scope:
  - src/frontend/src/app/api/monitor/route.ts
---
`src/app/api/monitor/route.ts`에서 배열 인덱스 접근 시 `undefined` 가능성을 처리하지 않아 `noUncheckedIndexedAccess` strict 옵션에서 타입 오류 발생.

- 39행: `parts[0]` — `parseInt`에 `string | undefined` 전달
- 40행: `parts[1]` — 동일
- 103행: `parts[1]` — 동일
- 106-107행: `parts[2]`, `parts[3]` — 동일
- 210-212행: `loadAvg[0]`, `loadAvg[1]`, `loadAvg[2]` — `os.loadavg()`가 `number[]` 타입이므로 인덱스 접근 시 `undefined` 가능

수정 방법: 배열 인덱스 접근 후 `?? 0` 또는 `?? ""` fallback 추가, 또는 destructuring with defaults 사용.

## Completion Criteria
- `npx tsc --noEmit --noUncheckedIndexedAccess` 실행 시 해당 파일에서 타입 오류 0건
- 기존 동작(로직) 변경 없음
