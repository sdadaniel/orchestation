---
id: TASK-314
title: API-엔드포인트-매직스트링-상수-추출
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:
  - src/frontend/src/lib/api-routes.ts
  - src/frontend/src/store/tasksStore.ts
  - src/frontend/src/store/suggestStore.ts
  - src/frontend/src/providers/SseProvider.tsx
  - src/frontend/src/hooks/useTasks.ts
  - src/frontend/src/hooks/useRunHistory.ts
  - src/frontend/src/hooks/useRequests.ts
  - src/frontend/src/hooks/usePrds.ts
  - src/frontend/src/hooks/usePlanTree.ts
  - src/frontend/src/hooks/useNotices.ts
  - src/frontend/src/hooks/useMonitor.ts
  - src/frontend/src/hooks/useDocTree.ts
  - src/frontend/src/hooks/useCosts.ts
  - src/frontend/src/components/DAGCanvas.tsx
  - src/frontend/src/components/ChatBot.tsx
  - src/frontend/src/components/AutoImproveControl.tsx
  - src/frontend/src/app/tasks/new/page.tsx
  - src/frontend/src/app/settings/page.tsx
  - src/frontend/src/app/night-worker/page.tsx
---
프론트엔드 19개 파일에 걸쳐 `"/api/tasks"`, `"/api/requests"`, `"/api/settings"` 등 API 엔드포인트 문자열이 하드코딩되어 중복 사용됨. DRY 원칙 위반으로 엔드포인트 변경 시 누락 위험이 높음.

`src/frontend/src/lib/api-routes.ts`에 `API_ROUTES` 상수 객체를 생성하고, 19개 파일의 매직 스트링을 상수 참조로 교체한다. 로직 변경 없이 문자열 치환만 수행.

## Completion Criteria
- `src/frontend/src/lib/api-routes.ts` 파일에 모든 API 엔드포인트 상수 정의
- 19개 파일의 하드코딩된 `"/api/..."` 문자열을 `API_ROUTES.*` 상수로 교체
- `npm run build` 성공 (타입 에러 없음)
- 기존 동작 변경 없음 (순수 리팩터링)
