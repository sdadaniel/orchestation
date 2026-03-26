---
id: TASK-187
title: E2E 테스트 실행 및 실패 수정 — tasks-list
status: done
branch: task/task-187
worktree: ../repo-wt-task-187
priority: medium
created: 2026-03-26
updated: 2026-03-26
depends_on:
  - TASK-186
scope:
  - src/frontend/e2e/tasks-list.spec.ts
  - src/frontend/src/app/tasks/page.tsx
---

## 목표
tasks-list.spec.ts 시나리오를 실행하고, 실패하는 테스트의 원인을 분석하여 코드 수정.

## 작업
1. `npx playwright test e2e/tasks-list.spec.ts` 실행
2. 실패 시나리오 분석
3. 프론트엔드 코드 수정
4. 재실행하여 전체 통과 확인

## Completion Criteria
- tasks-list.spec.ts 전체 통과
