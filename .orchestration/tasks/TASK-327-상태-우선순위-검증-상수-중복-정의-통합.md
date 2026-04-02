---
id: TASK-327
title: 상태-우선순위-검증-상수-중복-정의-통합
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:
  - src/frontend/src/lib/parser.ts
  - src/frontend/src/lib/request-parser.ts
  - src/frontend/src/lib/waterfall.ts
  - src/frontend/src/app/api/tasks/route.ts
  - src/frontend/src/app/api/tasks/[id]/route.ts
  - src/frontend/src/app/api/requests/route.ts
---
VALID_STATUSES / VALID_PRIORITIES 상수가 6개 파일에 중복 정의되어 있다.
파일마다 포함 항목이 다르다 (예: api/tasks/route.ts와 api/tasks/[id]/route.ts는 "critical" 우선순위 포함, parser.ts와 request-parser.ts는 미포함).
상수 불일치로 인해 특정 경로에서만 유효성 검증이 달라지는 잠재적 버그가 있다.

공유 상수 파일(예: `src/frontend/src/lib/constants.ts`)에 단일 정의하고 모든 파일에서 import하도록 변경한다.

## Completion Criteria
- VALID_STATUSES, VALID_PRIORITIES 상수를 하나의 공유 파일에 단일 정의
- 기존 6개 파일에서 로컬 상수 제거 후 공유 상수를 import
- 모든 파일에서 동일한 유효 값 목록 사용 (불일치 해소)
- 기존 타입(TaskStatus, TaskPriority)과 호환 유지
- `npm run build` 통과
