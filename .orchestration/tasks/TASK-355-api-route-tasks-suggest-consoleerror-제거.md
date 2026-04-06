---
id: TASK-355
title: api-route-tasks-suggest-console.error-제거
status: done
branch: task/task-355
worktree: ../repo-wt-task-355
priority: medium
mode: night
created: 2026-04-06 12:25
updated: 2026-04-06 11:40
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/suggest/route.ts
---
API 라우트 파일에 불필요한 console.error() 문 3개를 제거합니다.

46번: console.error("Claude CLI stderr:", stderr);
71번: console.error("Failed to parse suggest response:", stdout);
83번: console.error("Claude CLI spawn error:", err.message);

이미 적절한 에러 응답을 클라이언트에 반환하고 있으므로 디버그 로그는 불필요합니다.

## Completion Criteria
- console.error() 3개 제거
- 에러 처리 로직은 유지