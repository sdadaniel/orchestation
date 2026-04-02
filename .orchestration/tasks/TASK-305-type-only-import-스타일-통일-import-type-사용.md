---
id: TASK-305
title: type-only-import-스타일-통일-import-type-사용
status: failed
branch: task/task-305
worktree: ../repo-wt-task-305
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 15:48
depends_on: []
scope:
  - src/frontend/src/components/RequestCard.tsx
  - src/frontend/src/components/DAGCanvas.tsx
---
`RequestCard.tsx`와 `DAGCanvas.tsx`에서 type-only import 시 `import { type X }` 형식을 사용하고 있으나, 코드베이스의 나머지 파일들은 `import type { X }` 형식을 사용함. 단독 타입 import에서 일관성을 위해 `import type { X }` 형식으로 통일 필요.

- `RequestCard.tsx:7` — `import { type RequestItem }` → `import type { RequestItem }`
- `DAGCanvas.tsx:6` — `import { type RequestItem }` → `import type { RequestItem }`

## Completion Criteria
- 두 파일의 type-only import를 `import type { X } from "..."` 형식으로 변경
- 빌드 에러 없음 확인
