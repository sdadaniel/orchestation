---
id: TASK-229
title: orchestration-manager console.log를 appendLog로 교체
status: in_progress
branch: task/task-229
worktree: ../repo-wt-task-229
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/lib/orchestration-manager.ts
---
`cleanupZombies()` 메서드 내 `console.log` / `console.warn` 5건을 `this.appendLog()`로 교체.

해당 파일의 다른 메서드들은 이미 `this.appendLog()`를 사용하고 있으나, `cleanupZombies()`만 `console.log`/`console.warn`을 직접 호출하여 코드 스타일이 불일치함.

- L367: `console.log(`[orchestrate] ${taskId}: PID 파일 없으나...`)`
- L375: `console.log(`[orchestrate] zombie cleanup: ...`)`
- L379: `console.log(`[orchestrate] ${cleaned}개 좀비...`)`
- L391: `console.log("[orchestrate] stale lock 제거")`
- L396: `console.warn("[orchestrate] zombie cleanup error:", err)`

## Completion Criteria
- `cleanupZombies()` 내 `console.log` / `console.warn` 호출이 0건
- 모든 로그가 `this.appendLog()`를 통해 출력
- 기존 로그 메시지 내용은 변경하지 않음
- TypeScript 컴파일 에러 없음
