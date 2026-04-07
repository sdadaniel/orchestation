---
id: TASK-326
title: parser-유틸-as-any-타입-단언-제거
status: done
branch: task/task-326
worktree: ../repo-wt-task-326
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 09:11
depends_on: []
scope:
  - src/frontend/src/lib/notice-parser.ts
  - src/frontend/src/lib/request-parser.ts
---
`notice-parser.ts`와 `request-parser.ts`에서 `Array.includes()` 호출 시 `as any` 타입 단언을 사용하고 있음. `as const` 배열을 `(readonly string[])` 로 캐스팅하여 `as any` 없이 타입 안전하게 수정.

- `notice-parser.ts:21` — `VALID_NOTICE_TYPES.includes(value as any)` → `(VALID_NOTICE_TYPES as readonly string[]).includes(value)`
- `request-parser.ts:25` — `VALID_STATUSES.includes(value as any)` → `(VALID_STATUSES as readonly string[]).includes(value)`
- `request-parser.ts:29` — `VALID_PRIORITIES.includes(value as any)` → `(VALID_PRIORITIES as readonly string[]).includes(value)`

## Completion Criteria
- 3개 파일의 `as any` 타입 단언이 모두 제거됨
- `npx tsc --noEmit` 타입체크 통과
- 기존 동작 변경 없음
