---
id: TASK-325
title: parser-includes-as-any-타입-단언-제거
status: done
branch: task/task-325
worktree: ../repo-wt-task-325
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 09:11
depends_on: []
scope:
  - src/frontend/src/lib/request-parser.ts
  - src/frontend/src/lib/notice-parser.ts
---
`request-parser.ts`와 `notice-parser.ts`의 `isValidStatus`, `isValidPriority`, `isValidNoticeType` 함수에서 `VALID_*.includes(value as any)` 패턴 사용 중. `as any` 타입 단언은 strict 모드의 타입 안전성을 우회한다.

`(VALID_STATUSES as readonly string[]).includes(value)` 형태로 변경하여 `as any` 제거.

## Completion Criteria
- `request-parser.ts`의 `isValidStatus`, `isValidPriority` 함수에서 `as any` 제거
- `notice-parser.ts`의 `isValidNoticeType` 함수에서 `as any` 제거
- `npx tsc --noEmit` 통과 확인
