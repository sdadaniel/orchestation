---
id: TASK-236
title: 미사용 코드 정리 (frontmatter-utils, useSSEWatch, userIdx)
status: pending
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/lib/frontmatter-utils.ts
  - src/frontend/src/hooks/useSSEWatch.ts
  - src/frontend/src/app/api/monitor/route.ts
---
미사용 코드 3건을 정리한다.

1. `src/frontend/src/lib/frontmatter-utils.ts` — 파일 전체 삭제. 내보낸 함수 5개(`parseFrontmatter`, `getString`, `getBool`, `getInt`, `getStringArray`)가 어디에서도 import되지 않음.
2. `src/frontend/src/hooks/useSSEWatch.ts` — 파일 전체 삭제. `useSSEWatch` 훅이 어디에서도 import되지 않음.
3. `src/frontend/src/app/api/monitor/route.ts` 97행 — 미사용 변수 `userIdx` 선언 제거.

## Completion Criteria
- `frontmatter-utils.ts` 파일 삭제됨
- `useSSEWatch.ts` 파일 삭제됨
- `route.ts`에서 `userIdx` 변수 제거됨
- `npm run build` 성공 (기존 기능 영향 없음)
