---
id: TASK-147
title: 프론트엔드 미사용 import·변수 34건 정리
status: in_progress
branch: task/task-147
worktree: ../repo-wt-task-147
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/e2e/tasks-list.spec.ts
  - src/frontend/src/app/api/docs/route.ts
  - src/frontend/src/app/api/tasks/watch/route.ts
  - src/frontend/src/app/night-worker/page.tsx
  - src/frontend/src/app/notices/page.tsx
  - src/frontend/src/app/sprint/[id]/page.tsx
  - src/frontend/src/app/sprint/page.tsx
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/app/tasks/page.tsx
  - src/frontend/src/components/AppShell.tsx
  - src/frontend/src/components/AutoImproveControl.tsx
  - src/frontend/src/components/BatchEditor.tsx
  - src/frontend/src/components/cost/CostTable.tsx
  - src/frontend/src/components/DAGCanvas.tsx
  - src/frontend/src/components/DependsOnSelector.tsx
  - src/frontend/src/components/monitor/MetricCard.tsx
  - src/frontend/src/components/monitor/SystemInfo.tsx
  - src/frontend/src/components/RightPanel.tsx
  - src/frontend/src/components/sidebar.tsx
  - src/frontend/src/components/TaskEditSheet.tsx
  - src/frontend/src/components/TaskRow.tsx
  - src/frontend/src/components/waterfall/TaskBar.tsx
---

TypeScript `--noUnusedLocals` 플래그로 검출된 미사용 import, 변수, 함수 34건을 제거한다.

모두 선언만 되고 실제 참조되지 않는 코드이므로 로직 변경 없이 안전하게 삭제 가능하다.

### 주요 항목

| 파일 | 미사용 심볼 |
|------|------------|
| `e2e/tasks-list.spec.ts` | `main` |
| `api/docs/route.ts` | `findNodeById` |
| `api/tasks/watch/route.ts` | `NextResponse` |
| `night-worker/page.tsx` | `XCircle`, `History` |
| `notices/page.tsx` | `NoticeItem` |
| `sprint/[id]/page.tsx` | `Pencil`, `selectedTask`, `setSelectedTask` |
| `sprint/page.tsx` | `AlertCircle` |
| `tasks/[id]/page.tsx` | `RotateCcw`, `Copy` |
| `tasks/page.tsx` | `STATUS_LABEL`, `filteredStatuses` |
| `AppShell.tsx` | `error` |
| `AutoImproveControl.tsx` | `hasRunningTasks` |
| `BatchEditor.tsx` | `priorityStyle` |
| `CostTable.tsx` | `PAGE_SIZE`, `SORTABLE_HEADERS` |
| `DAGCanvas.tsx` | `statusMap` |
| `DependsOnSelector.tsx` | `Search` |
| `MetricCard.tsx` | `ChartComponent` |
| `SystemInfo.tsx` | `loadAvg` |
| `RightPanel.tsx` | `statusStyle`, `priorityStyle` |
| `sidebar.tsx` | `StatusBadge`, `STATUS_STYLES`, `groups`, `prds`, `filter`, `onFilterChange` |
| `TaskEditSheet.tsx` | `cn` |
| `TaskRow.tsx` | `priorityStyle` |
| `TaskBar.tsx` | `priorityStyle` |

## Completion Criteria
- `npx tsc --noEmit --noUnusedLocals` 실행 시 TS6133 에러 0건
- 기존 동작(빌드, 렌더링)에 변화 없음
- import 제거 외 로직 수정 없음
