---
id: TASK-227
title: err-instanceof-Error-중복-패턴-유틸-함수-추출
status: in_progress
branch: task/task-227
worktree: ../repo-wt-task-227
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26 09:44:11
depends_on: []
scope:
  - src/frontend/src/lib/error-utils.ts
  - src/frontend/src/hooks/useTasks.ts
  - src/frontend/src/hooks/useNotices.ts
  - src/frontend/src/hooks/useCosts.ts
  - src/frontend/src/store/tasksStore.ts
  - src/frontend/src/store/noticesStore.ts
  - src/frontend/src/lib/orchestration-manager.ts
  - src/frontend/src/lib/task-runner-manager.ts
  - src/frontend/src/lib/auto-improve-manager.ts
  - src/frontend/src/components/TaskCreateDialog.tsx
  - src/frontend/src/components/TaskEditSheet.tsx
  - src/frontend/src/components/TaskDeleteDialog.tsx
  - src/frontend/src/components/TaskLogModal.tsx
  - src/frontend/src/components/TaskLogTab.tsx
  - src/frontend/src/components/AutoImproveControl.tsx
  - src/frontend/src/components/SprintCreateDialog.tsx
  - src/frontend/src/app/api/tasks/route.ts
  - src/frontend/src/app/api/tasks/[id]/route.ts
  - src/frontend/src/app/api/tasks/suggest/route.ts
  - src/frontend/src/app/api/tasks/[id]/logs/route.ts
  - src/frontend/src/app/api/notices/route.ts
  - src/frontend/src/app/api/requests/route.ts
  - src/frontend/src/app/api/requests/[id]/route.ts
  - src/frontend/src/app/api/sprints/route.ts
  - src/frontend/src/app/tasks/new/page.tsx
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/server.ts
---
`err instanceof Error ? err.message : "fallback"` 패턴이 23개 파일, 30회 중복 사용됨. 공통 유틸 함수로 추출하여 DRY 원칙 준수.

### 현황
- `err instanceof Error ? err.message : "..."` 패턴이 hooks, components, API routes, managers, stores 전반에 산재
- 각 위치마다 fallback 메시지가 한국어/영어로 불일치

### 작업 내용
1. `src/frontend/src/lib/error-utils.ts`에 `getErrorMessage(error: unknown, fallback?: string): string` 유틸 함수 생성
2. 23개 파일의 30개 인스턴스를 해당 유틸 함수 호출로 교체

## Completion Criteria
- `getErrorMessage` 유틸 함수가 `src/frontend/src/lib/error-utils.ts`에 존재
- `err instanceof Error ? err.message :` 패턴의 직접 사용이 0건
- 기존 테스트 통과 및 빌드 정상
