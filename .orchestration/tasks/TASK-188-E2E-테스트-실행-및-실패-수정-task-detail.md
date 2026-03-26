---
id: TASK-188
title: E2E 테스트 실행 및 실패 수정 — task-detail
status: stopped
branch: task/task-188
worktree: ../repo-wt-task-188
priority: medium
created: 2026-03-26
updated: 2026-03-26 08:48:38
depends_on:
  - TASK-186
scope:
  - src/frontend/e2e/task-detail.spec.ts
  - src/frontend/src/app/tasks/[id]/page.tsx
---
## 목표
task-detail.spec.ts 시나리오를 실행하고, 실패하는 테스트의 원인을 분석하여 코드 수정.

## Completion Criteria
- task-detail.spec.ts 전체 통과
