---
id: TASK-141
title: "ProcessMetrics.tsx eslint-disable any 타입 6건 제거"
status: done
branch: task/task-141
worktree: ../repo-wt-task-141
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/components/monitor/ProcessMetrics.tsx
---

`ProcessMetrics.tsx`에 `// eslint-disable-next-line @typescript-eslint/no-explicit-any`와 함께 사용된 `any` 타입이 6건 존재한다 (134, 178, 226, 235, 290, 299번 줄 부근).

모두 Recharts의 `<Tooltip formatter={...}>` 콜백 파라미터로, Recharts가 제공하는 타입(`Formatter`, `ValueType`, `NameType`, `Props`)으로 대체 가능하다.

## 현재 코드 (반복 패턴)

```tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
formatter={(v: any, _: any, props: any) => [ ... ]}
```

## 수정 방향

Recharts의 `Formatter` 타입 또는 `ValueType`/`NameType` 제네릭을 활용하여 `any`를 구체 타입으로 교체하고, `eslint-disable` 주석을 제거한다. 로직 변경 없이 타입 주석만 수정하는 경미한 변경이다.

## Completion Criteria

- `ProcessMetrics.tsx`에서 `eslint-disable-next-line @typescript-eslint/no-explicit-any` 주석 0건
- `any` 타입 사용 0건
- `npx tsc --noEmit` 타입 체크 통과
- 기존 동작(차트 툴팁 포맷) 변경 없음
