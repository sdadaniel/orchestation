---
id: TASK-272
title: 프론트엔드 미사용 import/변수 정리
status: done
branch: task/task-272
worktree: ../repo-wt-task-272
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:  []
---

Now I have the info I need. The issue: unused imports and variables across multiple frontend files.

---
id: TASK-272
title: 프론트엔드 미사용 import/변수 정리
status: done
branch: task/task-272
worktree: ../repo-wt-task-272
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/components/AppShell.tsx
  - src/frontend/src/components/AutoImproveControl.tsx
  - src/frontend/src/components/plan/PlanTreeContainer.tsx
  - src/frontend/src/components/TaskLogTab.tsx
  - src/frontend/src/lib/task-runner-iterm.ts
  - src/frontend/src/store/suggestStore.ts
  - src/frontend/src/app/api/monitor/route.ts
  - src/frontend/src/app/tasks/[id]/TaskMetadata.tsx
---
`tsc --noUnusedLocals --noUnusedParameters` 기준으로 프론트엔드 소스에 미사용 import 및 변수가 10건 존재한다. 로직 변경 없이 미사용 선언만 제거한다.

주요 항목:
- `AppShell.tsx`: 미사용 import `RunningIndicator`, 미사용 변수 `error`
- `AutoImproveControl.tsx`: 미사용 import `HorseRunningIndicator`, 미사용 변수 `isRunning`
- `PlanTreeContainer.tsx`: 미사용 import `useRouter`
- `TaskLogTab.tsx`: 미사용 변수 `autoScroll`
- `task-runner-iterm.ts`: 미사용 import `spawn`
- `suggestStore.ts`: 미사용 변수 `get`
- `monitor/route.ts`: 미사용 변수 `userIdx`
- `TaskMetadata.tsx`: 미사용 변수 `id`

## Completion Criteria
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` 에서 위 8개 파일 관련 에러 0건
- 기존 기능 동작에 변경 없음 (로직 수정 금지)

## Completion Criteria


