---
id: TASK-274
title: 미사용 컴포넌트·훅·스토어 데드 파일 삭제
status: in_progress
branch: task/task-274
worktree: ../repo-wt-task-274
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:  []
---

All confirmed — these are only defined in their own files, never imported. The stories reference `TaskRow` as a story name, not an import of the component.

---
id: TASK-274
title: 미사용 컴포넌트·훅·스토어 데드 파일 삭제
status: in_progress
branch: task/task-274
worktree: ../repo-wt-task-274
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/components/BatchEditor.tsx
  - src/frontend/src/components/RightPanel.tsx
  - src/frontend/src/components/TaskCreateDialog.tsx
  - src/frontend/src/components/TaskDeleteDialog.tsx
  - src/frontend/src/components/TaskEditSheet.tsx
  - src/frontend/src/components/TaskLogTab.tsx
  - src/frontend/src/components/TaskRow.tsx
  - src/frontend/src/components/monitor/CpuChart.tsx
  - src/frontend/src/components/monitor/CpuMetrics.tsx
  - src/frontend/src/components/monitor/SystemInfo.tsx
  - src/frontend/src/components/waterfall/WaterfallContainer.tsx
  - src/frontend/src/hooks/useOrchestrationStatus.ts
  - src/frontend/src/hooks/useSSEWatch.ts
  - src/frontend/src/store/noticesStore.ts
---
프론트엔드에 어디서도 import되지 않는 데드 파일 14개가 존재한다. 컴포넌트 11개, 커스텀 훅 2개, Zustand 스토어 1개. 각 파일의 export가 codebase 전체에서 한 번도 참조되지 않음을 확인 완료. 해당 파일을 삭제한다.

## Completion Criteria
- scope에 명시된 14개 파일 전부 삭제
- `npx tsc --noEmit` 에러 0건 (삭제 후 빌드 깨짐 없음)
- 기존 기능 동작에 변경 없음 (로직 수정 금지)

## Completion Criteria


