---
id: TASK-278
title: API 라우트 slug 생성 로직 중복 제거
status: done
branch: task/task-278
worktree: ../repo-wt-task-278
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:  []
---

TASK-278은 이미 reserved 상태이므로 TASK-279로 생성합니다.

---
id: TASK-279
title: API 라우트 slug 생성 로직 중복 제거
status: done
branch: task/task-278
worktree: ../repo-wt-task-278
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/route.ts
  - src/frontend/src/app/api/notices/route.ts
  - src/frontend/src/app/api/requests/route.ts
  - src/frontend/src/app/api/requests/[id]/route.ts
---
API 라우트 4개 파일에서 slug 생성 로직(`.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/-+$/, "")`)이 5회 이상 동일하게 반복됨. 공유 유틸리티 함수로 추출하여 DRY 원칙 준수.

## Completion Criteria
- `generateSlug()` 유틸리티 함수를 공통 모듈에 추출
- 4개 API 라우트 파일에서 인라인 slug 생성 코드를 `generateSlug()` 호출로 교체
- 기존 동작 변경 없음 (로직 동일 유지)

## Completion Criteria


