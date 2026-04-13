---
id: TASK-350
title: globalThis-싱글턴-패턴-Record-string-unknown-타입-단언-통합-유틸-추출
status: failed
branch: task/task-350
worktree: ../repo-wt-task-350
priority: medium
mode: night
created: 2026-04-06T00:00:00.000Z
updated: '2026-04-13 00:00'
depends_on: []
scope:
  - src/frontend/src/lib/orchestration-manager.ts
  - src/frontend/src/lib/task-runner-manager.ts
  - src/frontend/src/lib/auto-improve-manager.ts
---
3개 매니저 파일에서 `(globalThis as Record<string, unknown>)[key]` 패턴이 반복 사용됨.
`Record<string, unknown>` 타입 단언은 타입 안전성이 낮고, 동일 패턴이 3회 반복되므로 공통 유틸 함수로 추출한다.

```typescript
// 예시: src/frontend/src/lib/get-global-singleton.ts
function getGlobalSingleton<T>(key: string, factory: () => T): T {
  const g = globalThis as Record<string, unknown>;
  return (g[key] as T) ?? (g[key] = factory());
}
```

## Completion Criteria
- `getGlobalSingleton<T>(key, factory)` 유틸 함수를 생성하여 `Record<string, unknown>` 단언을 한 곳으로 격리
- orchestration-manager.ts, task-runner-manager.ts, auto-improve-manager.ts 에서 해당 유틸 사용으로 교체
- 기존 동작(HMR 싱글턴 유지) 변경 없음
- TypeScript 컴파일 에러 없음
