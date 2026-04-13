---
id: TASK-361
title: TypeScript-strict-모드-STATUS_STYLES-text-필드-타입-에러-수정
status: failed
priority: medium
branch: task/task-361
worktree: ../repo-wt-task-361
role: general
depends_on: []
scope: 
  - src/frontend/src/components/ui/badge.tsx
  - src/frontend/src/constants/theme.ts
created: 2026-04-07 15:17:49
updated: 2026-04-10 15:45:13
---
src/frontend/src/components/ui/badge.tsx:49 에서 STATUS_STYLES 객체의 `text` 필드가 타입 정의에 없어 TS2339 에러 발생. STATUS_STYLES에 각 상태별 텍스트 색상 필드를 추가하여 해결.

## Completion Criteria
- STATUS_STYLES의 모든 항목에 `text` 필드 추가 (text-white)
- TypeScript strict 모드에서 에러 없음
