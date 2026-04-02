---
id: TASK-310
title: src-내-미사용-import-변수-정리
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:  []
---

Confirmed: `useState` is imported but never used in AppShell.tsx. Let me also verify the other files to build a proper scope.

---
id: TASK-310
title: src-내-미사용-import-변수-정리
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:
  - src/frontend/src/components/AppShell.tsx
  - src/frontend/src/app/api/requests/route.ts
  - src/frontend/src/app/api/roles/route.ts
  - src/frontend/src/app/api/tasks/analyze/route.ts
  - src/frontend/src/lib/orchestrate-engine.ts
  - src/frontend/src/lib/parser.test.ts
  - src/frontend/src/lib/task-id.test.ts
---
TypeScript `--noUnusedLocals` / `--noUnusedParameters` 검사에서 발견된 미사용 import 및 변수를 제거한다.

발견 항목:
1. `AppShell.tsx` — `useState` import 미사용
2. `api/requests/route.ts` — `path` import, `PROJECT_ROOT` 변수 미사용
3. `api/roles/route.ts` — `path` import 미사용
4. `api/tasks/analyze/route.ts` — `path` import, `PROJECT_ROOT` 변수 미사용
5. `orchestrate-engine.ts` — `pendingSignalCheck` 변수 미사용
6. `parser.test.ts` — `afterEach`, `Dirent`, `path` import 미사용
7. `task-id.test.ts` — `Dirent` import 미사용

## Completion Criteria
- 위 7개 파일에서 미사용 import/변수를 제거한다
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` 실행 시 src/ 경로 내 에러 0건
- 기존 테스트(`npm test`)가 모두 통과한다

## Completion Criteria


