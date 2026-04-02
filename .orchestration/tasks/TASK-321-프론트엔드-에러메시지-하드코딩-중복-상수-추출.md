---
id: TASK-321
title: 프론트엔드-에러메시지-하드코딩-중복-상수-추출
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:
  - src/frontend/src/hooks/useTasks.ts
  - src/frontend/src/hooks/usePlanTree.ts
  - src/frontend/src/hooks/usePrds.ts
  - src/frontend/src/hooks/useRequests.ts
  - src/frontend/src/hooks/useCosts.ts
  - src/frontend/src/store/tasksStore.ts
---
`"데이터를 불러오는데 실패했습니다."` 등 fetch 실패 에러 메시지가 6개 파일에 하드코딩으로 중복되어 있다. 상수 파일로 추출하여 DRY 원칙을 적용한다.

- `useTasks.ts:20` — `"데이터를 불러오는데 실패했습니다."`
- `usePlanTree.ts:29` — `"데이터를 불러오는데 실패했습니다."`
- `tasksStore.ts:77` — `"데이터를 불러오는데 실패했습니다."`
- `tasksStore.ts:105` — `"요청 데이터를 불러오는데 실패했습니다."`
- `useRequests.ts:20` — `"요청 데이터를 불러오는데 실패했습니다."`
- `usePrds.ts:15` — `"PRD 데이터를 불러오는데 실패했습니다."`
- `useCosts.ts:17` — `"비용 데이터를 불러오는데 실패했습니다."`

## Completion Criteria
- `src/frontend/src/lib/error-messages.ts` 상수 파일 생성
- 위 7개 하드코딩 메시지를 상수 import로 교체
- 기존 동작(throw Error) 변경 없음
