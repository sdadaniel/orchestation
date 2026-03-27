---
id: TASK-269
title: API route validStatuses 불일치 수정
status: in_progress
branch: task/task-269
worktree: ../repo-wt-task-269
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/[id]/route.ts
  - src/frontend/lib/constants.ts
---

`src/frontend/src/app/api/tasks/[id]/route.ts` 52번째 줄의 `validStatuses` 배열이 프로젝트 표준 상태값과 불일치합니다.

현재값: `["pending", "in_progress", "in_review", "done"]`
- `"in_review"` → 프로젝트 표준은 `"reviewing"` (constants.ts, parser.ts, CLAUDE.md 모두 `"reviewing"`)
- `"stopped"`, `"rejected"` 누락

수정 후 값: `["pending", "stopped", "in_progress", "reviewing", "done", "rejected"]`

## Completion Criteria
- `validStatuses` 배열이 `constants.ts`의 `TaskStatus` 타입과 동일한 6개 값을 포함
- `"in_review"` → `"reviewing"` 으로 변경
- `"stopped"`, `"rejected"` 추가
