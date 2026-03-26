---
id: TASK-245
title: "cost-parser.ts non-null assertion 제거 — strict 타입 안전성"
status: pending
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/lib/cost-parser.ts
---
`cost-parser.ts`의 `summarizeByTask()` 함수에서 `Map.get()` 반환값에 non-null assertion(`!`)을 사용하고 있음.

- **Line 137**: `modelsMap.get(e.taskId)!.add(e.model)` — `Map.get()`은 `T | undefined`를 반환하므로 `!` 사용은 strict 모드에서 타입 안전성을 깨뜨림.
- **Line 153**: `const models = modelsMap.get(taskId)!` — 동일 패턴.

**수정 방향**: non-null assertion을 제거하고, optional chaining 또는 guard clause로 교체.

```typescript
// Line 137: before
modelsMap.get(e.taskId)!.add(e.model);
// after
modelsMap.get(e.taskId)?.add(e.model);

// Line 153: before
const models = modelsMap.get(taskId)!;
// after
const models = modelsMap.get(taskId) ?? new Set<string>();
```

## Completion Criteria
- `cost-parser.ts`에서 `!` (non-null assertion) 제거
- optional chaining 또는 fallback 값으로 교체
- `tsc --noEmit --strict` 통과
- 기존 동작 변경 없음
