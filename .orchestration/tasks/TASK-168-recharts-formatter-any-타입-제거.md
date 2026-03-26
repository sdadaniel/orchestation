---
id: TASK-168
title: Recharts formatter 콜백 any 타입을 구체 타입으로 교체
status: done
branch: task/task-168
worktree: ../repo-wt-task-168
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/components/monitor/MetricCard.tsx
  - src/frontend/src/components/monitor/CpuChart.tsx
  - src/frontend/src/components/cost/CumulativeCostChart.tsx
---

Recharts의 `Tooltip` formatter와 `Legend` formatter 콜백에서 `any` 타입을 사용하고 `eslint-disable-next-line @typescript-eslint/no-explicit-any` 주석으로 억제 중. 총 4곳:

1. **MetricCard.tsx:118** — `Tooltip` formatter `(v: any, name: any)`
2. **MetricCard.tsx:137** — `Legend` formatter `(val: any)`
3. **CpuChart.tsx:34** — `Tooltip` formatter `(value: any, name: any)`
4. **CumulativeCostChart.tsx:101** — `Tooltip` formatter `(value: any, name: any)`

Recharts는 `Formatter` 타입을 export하며, value는 `string | number`, name은 `string`으로 좁힐 수 있다.

## Completion Criteria
- 4곳의 `any` 타입을 `string | number` / `string` 등 구체 타입으로 교체
- 4개의 `eslint-disable-next-line` 주석 제거
- `npx tsc --noEmit` 통과
