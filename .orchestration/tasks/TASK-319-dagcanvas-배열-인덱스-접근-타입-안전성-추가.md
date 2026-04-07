---
id: TASK-319
title: DAGCanvas-배열-인덱스-접근-타입-안전성-추가
status: rejected
branch: task/task-319
worktree: ../repo-wt-task-319
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 08:55
depends_on: []
scope:  []
---

Good, it's just a reserved placeholder. Now I'll output the task.

---
id: TASK-319
title: DAGCanvas-배열-인덱스-접근-타입-안전성-추가
status: failed
branch: task/task-319
worktree: ../repo-wt-task-319
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 17:51
depends_on: []
scope:
  - src/frontend/src/components/DAGCanvas.tsx
---
`computeDAGLayout` 함수에서 `pendingByDepth[i]` 배열 인덱스 접근이 타입 가드 없이 사용됨.

`noUncheckedIndexedAccess` 기준으로 `pendingByDepth[i]`는 `RequestItem[] | undefined`이나, 현재 코드(74-75행)에서 직접 `.length` 및 `items` 할당에 사용하여 타입 불일치 발생.

루프 바운드로 런타임 안전하나, 엄격 타입 체크 시 오류. 로컬 변수에 할당 후 `undefined` 가드 추가 필요.

```typescript
// Before (line 73-76)
for (let i = pendingByDepth.length - 1; i >= 1; i--) {
  if (pendingByDepth[i].length > 0) {
    sections.push({ ..., items: pendingByDepth[i], ... });
  }
}

// After
for (let i = pendingByDepth.length - 1; i >= 1; i--) {
  const group = pendingByDepth[i];
  if (group && group.length > 0) {
    sections.push({ ..., items: group, ... });
  }
}
```

## Completion Criteria
- `pendingByDepth[i]` 접근에 `undefined` 가드 추가
- `npx tsc --noEmit --noUncheckedIndexedAccess` 기준 `DAGCanvas.tsx` 관련 오류 0건
- 기존 동작 변경 없음

## Completion Criteria


