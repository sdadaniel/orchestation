---
id: TASK-311
title: 날짜-포맷팅-중복코드-유틸리티-추출
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:
  - src/frontend/src/lib/request-parser.ts
  - src/frontend/src/lib/task-db-sync.ts
  - src/frontend/src/app/api/requests/route.ts
---
동일한 날짜/시간 포맷팅 패턴이 3개 파일에 인라인으로 중복 작성되어 있다. `task-db-sync.ts`에는 `formatTimestamp()` 함수가 존재하지만 다른 파일에서 재사용하지 않고 각각 `getFullYear()/getMonth()/padStart()` 체인을 반복한다. 포맷 불일치도 존재(초 포함 여부 차이).

공유 유틸리티 함수로 추출하여 DRY 원칙을 적용한다.

## Completion Criteria
- 날짜/시간 포맷팅 유틸리티 함수를 1곳에 정의하고 3개 파일에서 import하여 사용
- 기존 동작(출력 형식)은 변경 없음
- TypeScript 타입 체크 통과
