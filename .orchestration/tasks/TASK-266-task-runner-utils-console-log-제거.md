---
id: TASK-266
title: task-runner-utils console.log/error를 구조화된 로거로 교체
status: failed
branch: task/task-266
worktree: ../repo-wt-task-266
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/lib/task-runner-utils.ts
---
`task-runner-utils.ts`의 `updateTaskFileStatus()` 함수에 `console.log` / `console.error`가 3건 남아 있음 (no-console 위반).

- L50: `console.error(`[task-runner] updateTaskFileStatus: file not found ...`)`
- L58: `console.log(`[task-runner] ${taskId} status → ${status} ...`)`
- L60: `console.error(`[task-runner] updateTaskFileStatus failed:`, err)`

TASK-246에서 `orchestration-manager.ts`의 console 호출은 정리했으나, 같은 lib 디렉토리의 `task-runner-utils.ts`는 누락됨. 동일 패턴으로 교체한다.

## Completion Criteria
- `task-runner-utils.ts` 내 `console.log` / `console.error` 0건
- 기존 로직 변경 없음 (로그 출력 방식만 변경)
- 빌드(`npm run build`) 성공
