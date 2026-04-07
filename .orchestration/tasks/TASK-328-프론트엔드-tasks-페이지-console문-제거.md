---
id: TASK-328
title: 프론트엔드-tasks-페이지-console문-제거
status: done
branch: task/task-328
worktree: ../repo-wt-task-328
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 11:50
depends_on: []
scope:
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/app/tasks/new/page.tsx
---
`src/frontend/src/app/tasks/` 하위 클라이언트 컴포넌트에 `console.error`, `console.warn` 문이 5건 남아 있음. 프로덕션 코드에서 제거한다.

- `tasks/[id]/page.tsx` — console.error 3건, console.warn 1건 (L97, L110, L155, L159)
- `tasks/new/page.tsx` — console.error 1건 (L45)

## Completion Criteria
- 위 5건의 console 문이 모두 제거되었을 것
- `npx tsc --noEmit` 타입 체크 통과
- 기존 동작(에러 핸들링 로직)은 변경하지 않을 것
