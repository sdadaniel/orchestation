---
id: TASK-275
title: 프론트엔드 console 디버그 문 정리
status: failed
branch: task/task-275
worktree: ../repo-wt-task-275
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/app/tasks/new/page.tsx
  - src/frontend/src/components/DAGCanvas.tsx
  - src/frontend/src/components/sidebar/DocTreeNode.tsx
  - docs/todo/console-debug-cleanup.md
---
프론트엔드 클라이언트 컴포넌트에 남아 있는 console.error/warn/log 호출을 제거하거나 개발 환경 전용으로 래핑한다.

현재 클라이언트("use client") 컴포넌트 4개 파일에 총 7건의 console 디버그 문이 프로덕션 브라우저에 노출되고 있다.
서버 사이드(API route, lib) 파일의 console 출력은 서버 로그이므로 이번 범위에서 제외한다.

## Completion Criteria
- 클라이언트 컴포넌트 내 console.error/warn/log 호출이 제거되거나 `process.env.NODE_ENV === "development"` 조건으로 래핑됨
- 기존 에러 핸들링 로직(catch 블록 등)은 유지 — console 출력만 제거/래핑
- 빌드(`npm run build`) 에러 없음
- docs/todo/console-debug-cleanup.md 분석 보고서 작성 완료
