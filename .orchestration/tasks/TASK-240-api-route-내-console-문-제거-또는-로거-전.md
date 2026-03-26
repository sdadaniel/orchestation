---
id: TASK-240
title: API route 내 console 문 제거 또는 로거 전환
status: failed
branch: task/task-240
worktree: ../repo-wt-task-240
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/app/api/chat/route.ts
  - src/frontend/src/app/api/tasks/analyze/route.ts
---
API route 핸들러에 `console.error` 호출이 남아 있어 no-console ESLint 규칙 위반 가능성이 있고, 프로덕션에서 민감 정보(stderr 출력)가 서버 로그에 노출될 수 있음.

- `src/frontend/src/app/api/chat/route.ts` (L92, L99) — `console.error` 2건
- `src/frontend/src/app/api/tasks/analyze/route.ts` (L81, L148, L171) — `console.error` 3건

서버 사이드 로깅이 필요하면 구조화된 로거(예: `pino`, `winston`)로 교체하고, 불필요하면 제거한다.

## Completion Criteria
- 해당 파일의 `console.error` 호출이 제거되거나 구조화된 로거로 대체됨
- `npx tsc --noEmit` 통과
- 기존 동작(에러 응답 반환)에 변경 없음
