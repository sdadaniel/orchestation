---
id: TASK-312
title: DAGCanvas-topGroups-filter-타입-내로잉-누락-수정
status: done
branch: task/task-312
worktree: ../repo-wt-task-312
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 08:26
depends_on: []
scope:  []
---

Good. Now let me verify the file path for the task scope.

---
id: TASK-312
title: DAGCanvas-topGroups-filter-타입-내로잉-누락-수정
status: failed
branch: task/task-312
worktree: ../repo-wt-task-312
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 17:23
depends_on: []
scope:
  - src/frontend/src/components/DAGCanvas.tsx
---
`computeGroup`이 `null`을 반환할 수 있어 `topGroups[].box` 타입이 `{x,y,w,h} | null`이다. `.filter((g) => g.box !== null)`로 null을 걸러내지만, TypeScript는 type predicate 없이 타입을 좁히지 못한다. 결과적으로 285-286행에서 `g.box!` non-null assertion을 사용 중이며, strict 모드에서 안전하지 않은 패턴이다.

**수정**: `.filter((g): g is { label: string; color: string; box: NonNullable<typeof g.box> } => g.box !== null)` 형태의 type predicate를 추가하고, 285-286행의 `!` assertion을 제거한다.

## Completion Criteria
- `.filter()`에 type predicate 적용하여 `box`가 non-null로 내로잉됨
- 285-286행의 `g.box!` non-null assertion(`!`) 제거
- `npx tsc --noEmit --strict` 통과

## Completion Criteria


