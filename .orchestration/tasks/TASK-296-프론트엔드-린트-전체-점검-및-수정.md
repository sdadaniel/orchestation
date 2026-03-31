---
id: TASK-296
title: 프론트엔드 린트 전체 점검 및 수정
status: failed
branch: task/task-296
worktree: ../repo-wt-task-296
priority: high
role: frontend-dev
scope:
  - src/frontend/src/**
context:
  - src/frontend/package.json
  - src/frontend/.eslintrc*
  - src/frontend/tsconfig.json
created: 2026-03-31 15:16:37
updated: 2026-03-31 06:21
---
src/frontend 전체에 대해 ESLint 및 TypeScript 타입 체크를 실행하고, 발생하는 모든 오류와 경고를 수정한다. `npm run lint` 및 `tsc --noEmit` 실행 기준.

## Completion Criteria
- npm run lint 실행 시 오류 0건
- tsc --noEmit 실행 시 타입 오류 0건
- 경고(warning)도 가능한 한 제거
