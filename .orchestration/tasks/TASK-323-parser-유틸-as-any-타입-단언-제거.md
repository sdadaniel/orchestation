---
id: TASK-323
title: parser-유틸-as-any-타입-단언-제거
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:
  - src/frontend/src/lib/notice-parser.ts
  - src/frontend/src/lib/request-parser.ts
---
`notice-parser.ts`와 `request-parser.ts`에서 `as any` 타입 단언을 제거하고 타입 안전한 방식으로 교체한다.

현재 코드:
- `notice-parser.ts:21` — `VALID_NOTICE_TYPES.includes(value as any)`
- `request-parser.ts:25` — `VALID_STATUSES.includes(value as any)`
- `request-parser.ts:29` — `VALID_PRIORITIES.includes(value as any)`

수정 방향: `(arr as readonly string[]).includes(value)` 패턴 또는 타입 가드로 교체하여 `as any` 제거.

## Completion Criteria
- `as any` 타입 단언 3건 모두 제거
- TypeScript 컴파일 에러 없음
- 기존 동작 변경 없음
