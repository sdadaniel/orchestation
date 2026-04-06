---
id: TASK-356
title: src-frontend-src-app-api-tasks-analyze-route-console-error-제거
status: pending
priority: medium
mode: night
created: 2026-04-06 13:11
updated: 2026-04-06 13:11
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/analyze/route.ts
---
API 라우트 파일에서 console.error 문들을 제거합니다.

## Details
- 84행: console.error("Claude CLI stderr:", stderr);
- 154행: console.error("Failed to parse AI response:", stdout);
- 179행: console.error("Claude CLI spawn error:", err.message);

## Completion Criteria
- console.error 3건 모두 제거됨
- 파일이 정상적으로 동작함 (로직 변경 없음)