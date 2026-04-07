---
id: TASK-309
title: API route getDb() non-null assertion 제거 및 null 체크 추가
status: done
branch: task/task-309
worktree: ../repo-wt-task-309
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 08:17
depends_on: []
scope:  []
---

`getDb()` returns `Database | null` but 4 API routes use non-null assertion (`!`) instead of proper null check. This is a strict-mode type safety issue.

---
id: TASK-309
title: API route getDb() non-null assertion 제거 및 null 체크 추가
status: failed
branch: task/task-309
worktree: ../repo-wt-task-309
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 17:16
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/route.ts
  - src/frontend/src/app/api/requests/route.ts
  - src/frontend/src/app/api/notices/route.ts
  - src/frontend/src/app/api/tasks/[id]/logs/route.ts
---
`getDb()`는 `Database | null`을 반환하지만, 4개 API route에서 `getDb()!` (non-null assertion)으로 호출하고 있음. strict 모드에서 non-null assertion은 타입 안전성을 우회하므로, 명시적 null 체크로 교체해야 함.

각 파일에서 `const db = getDb()!;` → `const db = getDb(); if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });` 패턴으로 변경.

## Completion Criteria
- 4개 파일 모두 `getDb()!` non-null assertion 제거
- 각 위치에 명시적 null 체크 및 503 에러 응답 추가
- `npx tsc --noEmit` 타입 체크 통과

## Completion Criteria


