---
id: TASK-230
title: API 라우트 검증 상수 중복 제거 및 중앙화
status: pending
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/route.ts
  - src/frontend/src/app/api/tasks/[id]/route.ts
  - src/frontend/src/app/api/sprints/route.ts
  - src/frontend/src/app/api/requests/route.ts
  - src/frontend/src/lib/constants.ts
---
API 라우트 핸들러 4개 파일에서 `validPriorities`, `validStatuses` 배열이 각각 하드코딩되어 중복 정의됨. priorities는 파일마다 값이 다름(requests는 `critical` 누락). 공유 상수 파일로 추출하여 일관성 확보 필요.

## Completion Criteria
- `validPriorities`, `validStatuses` 상수를 `src/frontend/src/lib/constants.ts`에 정의
- 4개 API 라우트 파일에서 중복 배열 제거 후 공유 상수 import로 교체
- 기존 동작(validation 로직) 변경 없음 확인
