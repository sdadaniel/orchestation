---
id: TASK-156
title: "API 라우트 TASKS_DIR IIFE 내 require(\"fs\") → import된 fs 사용으로 통일"
status: in_progress
branch: task/task-156
worktree: ../repo-wt-task-156
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/route.ts
  - src/frontend/src/app/api/tasks/lastmod/route.ts
  - src/frontend/src/app/api/tasks/[id]/route.ts
  - src/frontend/src/app/api/tasks/[id]/result/route.ts
  - src/frontend/src/app/api/tasks/watch/route.ts
  - src/frontend/src/app/api/requests/[id]/route.ts
---

## 문제

6개 API 라우트 파일에서 상단에 `import fs from "fs"`를 이미 선언하고 있으나, `TASKS_DIR` / `OUTPUT_DIR` 초기화 IIFE 내부에서 `require("fs").existsSync(o)`를 별도로 호출하고 있다.

동일 모듈을 ESM `import`와 CommonJS `require` 두 방식으로 중복 참조하는 코드 스타일 문제.

### 현황 (6건)

| 파일 | 중복 호출 |
|------|-----------|
| `api/tasks/route.ts:8` | `require("fs").existsSync(o)` |
| `api/tasks/lastmod/route.ts:7` | `require("fs").existsSync(o)` |
| `api/tasks/[id]/route.ts:8` | `require("fs").existsSync(o)` |
| `api/tasks/[id]/result/route.ts:7` | `require("fs").existsSync(o)` |
| `api/tasks/watch/route.ts:7` | `require("fs").existsSync(o)` |
| `api/requests/[id]/route.ts:8` | `require("fs").existsSync(o)` |

### 수정 방법

각 파일의 IIFE 내부에서 `require("fs").existsSync(o)`를 `fs.existsSync(o)`로 교체한다.
이미 import된 `fs` 모듈을 그대로 사용하면 되므로 로직 변경 없음.

## Completion Criteria

- 6개 파일에서 `require("fs")` 호출이 제거됨
- 각 IIFE 내부에서 이미 import된 `fs.existsSync`를 사용
- `npx tsc --noEmit` 통과
- 기존 동작 변경 없음
