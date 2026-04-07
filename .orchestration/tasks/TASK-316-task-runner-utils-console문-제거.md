---
id: TASK-316
title: task-runner-utils-console문-제거
status: done
branch: task/task-316
worktree: ../repo-wt-task-316
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 08:33
depends_on: []
scope:
  - src/frontend/src/lib/task-runner-utils.ts
---
`task-runner-utils.ts`의 `updateTaskFileStatus` 함수에 `console.log`, `console.error` 호출이 3건 존재. 프로덕션 코드에서 no-console 규칙 위반.

- 50행: `console.error(...)` — 파일 미발견 시 에러 로깅
- 58행: `console.log(...)` — 상태 갱신 성공 로깅
- 60행: `console.error(...)` — catch 블록 에러 로깅

서버 사이드 유틸이므로 `console` 대신 별도 logger를 사용하거나, 불필요한 로깅은 제거한다.

## Completion Criteria
- `task-runner-utils.ts` 내 `console.log` / `console.error` 3건 제거 또는 프로젝트 logger로 교체
- ESLint no-console 규칙 위반 0건 확인
