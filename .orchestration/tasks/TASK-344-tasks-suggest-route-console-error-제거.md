---
id: TASK-344
title: tasks-suggest-route-console-error-제거
status: pending
priority: medium
mode: night
created: 2026-04-06
updated: 2026-04-06
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/suggest/route.ts
---
`src/frontend/src/app/api/tasks/suggest/route.ts` 파일에 `console.error` 호출이 3건 존재 (line 46, 71, 83). 프로덕션 API 라우트에서 console 직접 사용은 ESLint `no-console` 위반이며 구조화된 로깅이 아님. 해당 console.error 문을 제거하거나, 프로젝트에 로거 유틸이 있다면 교체한다.

## Completion Criteria
- `src/frontend/src/app/api/tasks/suggest/route.ts`에서 `console.error` 3건 제거
- TypeScript 빌드 에러 없음
- 기존 로직 변경 없음 (에러 응답 구조 유지)
