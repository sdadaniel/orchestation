---
id: TASK-324
title: 태스크-상태-우선순위-상수-중복-정의-통합
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:
  - src/frontend/src/app/tasks/constants.ts
  - src/frontend/src/app/tasks/[id]/types.ts
  - src/frontend/src/app/tasks/new/types.ts
  - src/frontend/src/app/requests/page.tsx
---
STATUS_DOT, STATUS_LABEL, PRIORITY_COLORS 상수가 4개 파일에 동일하게 중복 정의되어 있음.
하나의 공통 파일(예: src/frontend/src/lib/task-constants.ts)로 통합하고 각 파일에서 import하도록 변경.

## Completion Criteria
- PRIORITY_COLORS, STATUS_DOT, STATUS_LABEL 상수를 단일 파일로 통합
- 기존 4개 파일에서 중복 정의 제거하고 통합 파일에서 import
- TypeScript 타입 체크 통과 (npx tsc --noEmit)
- 기존 동작 변경 없음
