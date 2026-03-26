---
id: TASK-246
title: orchestration-manager console.log를 구조화된 로거로 교체
status: in_progress
branch: task/task-246
worktree: ../repo-wt-task-246
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/lib/orchestration-manager.ts
---
`orchestration-manager.ts`의 `cleanupZombies()` 메서드에서 `console.log` / `console.warn`을 직접 사용하고 있음. 동일 클래스에 이미 `appendLog()` 헬퍼가 존재하므로, 디버그/정보 로그는 `appendLog()`로, 에러/경고는 `console.error`로 통일하여 코드 스타일 일관성을 확보한다.

- 367행: `console.log` → `this.appendLog()`
- 375행: `console.log` → `this.appendLog()`
- 379행: `console.log` → `this.appendLog()`
- 391행: `console.log` → `this.appendLog()`
- 396행: `console.warn` → `console.error`

## Completion Criteria
- `orchestration-manager.ts` 내 `console.log` 호출이 0개일 것
- `console.warn` 호출이 0개이고 에러 경로는 `console.error`를 사용할 것
- 기존 로직 변경 없이 로깅 호출만 교체
- TypeScript 컴파일(`tsc --noEmit`) 통과
