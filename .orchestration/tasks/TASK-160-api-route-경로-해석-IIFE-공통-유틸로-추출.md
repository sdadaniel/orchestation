---
id: TASK-160
title: API route 경로 해석 IIFE 공통 유틸로 추출
status: done
branch: task/task-160
worktree: ../repo-wt-task-160
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/route.ts
  - src/frontend/src/app/api/tasks/[id]/route.ts
  - src/frontend/src/app/api/tasks/lastmod/route.ts
  - src/frontend/src/app/api/tasks/watch/route.ts
  - src/frontend/src/app/api/tasks/[id]/result/route.ts
  - src/frontend/src/app/api/tasks/analyze/route.ts
  - src/frontend/src/app/api/tasks/suggest/route.ts
  - src/frontend/src/app/api/requests/[id]/route.ts
  - src/frontend/src/app/api/chat/route.ts
  - src/frontend/src/app/api/night-worker/route.ts
  - src/frontend/src/lib/parser.ts
  - src/frontend/src/lib/request-parser.ts
  - src/frontend/src/lib/notice-parser.ts
---

# TASK-160: API route 경로 해석 IIFE 공통 유틸로 추출

## 문제

`PROJECT_ROOT`, `TASKS_DIR`, `OUTPUT_DIR` 등 프로젝트 디렉토리 경로 해석 로직이 13개 이상의 파일에 중복 정의되어 있다.

### 중복 현황

1. **`PROJECT_ROOT`** — 7개 파일에서 동일한 `path.resolve(process.cwd(), "..", "..")` 반복
   - `lib/parser.ts`, `lib/request-parser.ts`, `lib/notice-parser.ts`
   - `api/chat/route.ts`, `api/night-worker/route.ts`, `api/tasks/analyze/route.ts`, `api/tasks/suggest/route.ts`

2. **`TASKS_DIR` IIFE** — 4개 파일에서 `.orchestration/tasks` vs `docs/task` 분기 IIFE 복붙
   - `api/tasks/route.ts`, `api/tasks/[id]/route.ts`, `api/tasks/lastmod/route.ts`, `api/tasks/watch/route.ts`

3. **`OUTPUT_DIR` IIFE** — 2개 파일에서 `.orchestration/output` vs `output` 분기 IIFE 복붙
   - `api/requests/[id]/route.ts`, `api/tasks/[id]/result/route.ts`

### 안티패턴

- 경로 분기 로직이 변경되면 모든 파일을 수동으로 수정해야 하며 누락 위험이 높음
- IIFE 내부에서 `require("fs")`를 사용하는 부수적 문제도 동반 (TASK-156 연관)

## 해결 방안

`src/frontend/src/lib/paths.ts` 유틸 모듈을 신규 생성하여 경로 해석 로직을 한 곳에 집중시킨다.

```ts
// src/frontend/src/lib/paths.ts
import fs from "fs";
import path from "path";

export const PROJECT_ROOT = path.resolve(process.cwd(), "..", "..");

export const TASKS_DIR = (() => {
  const o = path.join(PROJECT_ROOT, ".orchestration", "tasks");
  return fs.existsSync(o) ? o : path.join(PROJECT_ROOT, "docs", "task");
})();

export const OUTPUT_DIR = (() => {
  const o = path.join(PROJECT_ROOT, ".orchestration", "output");
  return fs.existsSync(o) ? o : path.join(PROJECT_ROOT, "output");
})();
```

각 파일에서 로컬 정의를 제거하고 `import { PROJECT_ROOT, TASKS_DIR, OUTPUT_DIR } from "@/lib/paths"` 로 교체한다.

## Completion Criteria

- [ ] `src/frontend/src/lib/paths.ts` 생성, `PROJECT_ROOT` / `TASKS_DIR` / `OUTPUT_DIR` export
- [ ] 13개 파일의 로컬 경로 정의를 `@/lib/paths` import로 교체
- [ ] 기존 기능 동작에 변화 없음 (빌드 성공, 경로 해석 결과 동일)
