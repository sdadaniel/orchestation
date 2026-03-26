---
id: TASK-199
title: Notice 목록에 날짜+시간 표시
status: in_progress
branch: task/task-199
worktree: ../repo-wt-task-199
priority: medium
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/app/notices/page.tsx
  - src/frontend/src/lib/notice-parser.ts
---

## 현상
- Notice 목록에 날짜만 표시 (2026-03-25)
- 시간까지 표시되어야 언제 발생한 건지 구분 가능

## 수정 방향
- notice-parser.ts: created/updated 파싱 시 시간까지 포함 (request-parser와 동일하게 mtime fallback)
- notices/page.tsx: 날짜+시간(HH:MM) 표시

## Completion Criteria
- Notice에 2026-03-25 14:30 형태로 시간까지 표시
