---
id: TASK-182
title: "Recharts Tooltip/Legend 콜백 any 타입을 구체 타입으로 교체"
status: in_progress
branch: task/task-182
worktree: ../repo-wt-task-182
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/components/cost/CumulativeCostChart.tsx
  - src/frontend/src/components/monitor/CpuChart.tsx
  - src/frontend/src/components/monitor/MetricCard.tsx
---

Recharts `<Tooltip>` 및 `<Legend>`의 `formatter` 콜백에서 `eslint-disable @typescript-eslint/no-explicit-any`로 억제된 `any` 타입 4건을 구체 타입으로 교체한다.

### 현황 (4건)

| 파일 | 줄 | 현재 시그니처 |
|------|-----|---------------|
| `CumulativeCostChart.tsx` | 101 | `(value: any, name: any)` |
| `CpuChart.tsx` | 34 | `(value: any, name: any)` |
| `MetricCard.tsx` | 118 | `(v: any, name: any)` |
| `MetricCard.tsx` | 137 | `(val: any)` |

### 수정 방법

- Recharts의 `Tooltip`의 `formatter` 시그니처: `(value: number, name: string, props: Payload) => ReactNode`
- `value` → `number`, `name` → `string`으로 교체
- Legend의 `formatter` 시그니처: `(value: string) => ReactNode`
- `val` → `string`으로 교체
- 각 `eslint-disable-next-line` 주석 제거

### 주의

- 로직 변경 없음. 타입 어노테이션만 교체
- `Number(value ?? 0)` 같은 방어 코드는 그대로 유지 (런타임 안전성)

## Completion Criteria
- 4건의 `eslint-disable @typescript-eslint/no-explicit-any` 주석 제거됨
- `any` → `number` / `string` 구체 타입으로 교체됨
- `npx tsc --noEmit` 통과
- 기존 동작 변경 없음
