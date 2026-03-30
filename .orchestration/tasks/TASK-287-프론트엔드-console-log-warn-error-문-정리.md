---
id: TASK-287
title: 프론트엔드 console.log/warn/error 문 정리
status: in_progress
branch: task/task-287
worktree: ../repo-wt-task-287
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:
  - src/frontend/src/lib/task-runner-utils.ts
  - src/frontend/src/lib/orchestration-manager.ts
  - src/frontend/src/app/tasks/new/page.tsx
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/app/api/chat/route.ts
  - src/frontend/src/app/api/tasks/suggest/route.ts
  - src/frontend/src/app/api/tasks/analyze/route.ts
  - src/frontend/src/components/DAGCanvas.tsx
  - src/frontend/src/components/sidebar/DocTreeNode.tsx
---
프론트엔드 소스 전체에 `console.log`, `console.warn`, `console.error` 호출이 9개 파일, 19건 산재해 있음.

프로덕션 코드에서 console 직접 호출은 ESLint `no-console` 규칙 위반이며, 브라우저 콘솔에 내부 구현 세부사항이 노출됨.

**작업 내용:**
1. 불필요한 `console.log` 제거 (예: `task-runner-utils.ts:58`)
2. 에러 핸들링이 필요한 곳은 `console.error`/`console.warn` 제거 후 조용히 실패하거나, 필요 시 상위로 에러 전파
3. API route 파일(`route.ts`)의 서버 사이드 로깅은 허용 가능하나, 클라이언트 컴포넌트의 console 호출은 모두 제거

## Completion Criteria
- 클라이언트 컴포넌트(page.tsx, DAGCanvas.tsx, DocTreeNode.tsx)에서 console.* 호출 0건
- `task-runner-utils.ts`, `orchestration-manager.ts`의 불필요한 console.log 제거
- 기존 에러 핸들링 로직은 유지 (catch 블록 자체를 삭제하지 않음)
- `npx next build` 정상 통과
