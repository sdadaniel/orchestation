---
id: TASK-320
title: DAGCanvas-DocTreeNode-console문-제거
status: done
branch: task/task-320
worktree: ../repo-wt-task-320
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 08:56
depends_on: []
scope:
  - src/frontend/src/components/DAGCanvas.tsx
  - src/frontend/src/components/sidebar/DocTreeNode.tsx
---
프론트엔드 컴포넌트에 남아있는 불필요한 console.error 디버그 문을 제거한다.

- `DAGCanvas.tsx:237` — `console.error("[DAGCanvas] settings fetch error:", err)` 제거
- `DocTreeNode.tsx:118` — `console.error("Reorder failed:", err)` 제거

## Completion Criteria
- 위 두 파일에서 console.error 문이 제거되었을 것
- TypeScript 컴파일 에러 없을 것
