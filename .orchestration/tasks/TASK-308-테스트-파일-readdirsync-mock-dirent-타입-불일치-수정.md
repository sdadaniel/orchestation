---
id: TASK-308
title: 테스트-파일-readdirSync-mock-Dirent-타입-불일치-수정
status: in_progress
branch: task/task-308
worktree: ../repo-wt-task-308
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 15:50
depends_on: []
scope:
  - src/frontend/src/lib/task-id.test.ts
  - src/frontend/src/lib/parser.test.ts
---
`fs.readdirSync` mock에서 plain string 배열을 반환하고 있으나, TypeScript strict 모드에서 `Dirent<NonSharedBuffer>` 타입이 요구됨. `as unknown as Dirent[]` 캐스팅 또는 `{ withFileTypes: false }` 오버로드에 맞는 mock 시그니처로 수정 필요.

## Completion Criteria
- `npx tsc --noEmit --strict` 실행 시 `task-id.test.ts`와 `parser.test.ts`의 TS2322 에러가 0건일 것
- 기존 테스트(`vitest run`)가 모두 통과할 것
