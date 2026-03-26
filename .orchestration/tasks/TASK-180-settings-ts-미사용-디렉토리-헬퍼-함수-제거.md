---
id: TASK-180
title: "settings.ts 미사용 디렉토리 헬퍼 함수 제거"
status: in_progress
branch: task/task-180
worktree: ../repo-wt-task-180
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/lib/settings.ts
---

## 문제

`settings.ts`에 `getOrchestrationDir()`, `getTasksDir()`, `getOutputDir()`, `getNoticesDir()` 4개 함수가 export되어 있으나, 프로젝트 전체에서 **단 한 곳도 import하지 않는 데드 코드**이다.

### 확인 결과

- `getTasksDir` — import 0건 (API route들은 자체 IIFE로 경로 해석)
- `getOutputDir` — import 0건
- `getOrchestrationDir` — import 0건 (내부에서 `getTasksDir` 등이 호출하지만 그 함수들도 미사용)
- `getNoticesDir` — `settings.ts`판은 import 0건. `notice-parser.ts:66`에 동일 이름 함수가 별도 존재하며, 실제 사용처(`api/notices/route.ts`)는 `notice-parser.ts`에서 import함

또한 내부 헬퍼 `getProjectRoot()`도 이 4개 함수에서만 사용되므로 함께 제거 가능.

### 수정 방안

1. `settings.ts`에서 `getProjectRoot()`, `getOrchestrationDir()`, `getTasksDir()`, `getOutputDir()`, `getNoticesDir()` 5개 함수 제거
2. `import fs from "fs"` / `import path from "path"` 중 `getConfigPath()`에서만 쓰이는 모듈은 유지 (현재 `loadSettings`/`saveSettings`에서 사용)
3. 로직 변경 없음 — 미사용 코드 삭제만 수행

## Completion Criteria

- [ ] `settings.ts`에서 5개 미사용 함수(`getProjectRoot`, `getOrchestrationDir`, `getTasksDir`, `getOutputDir`, `getNoticesDir`)가 제거됨
- [ ] `npx tsc --noEmit` 통과
- [ ] 기존 동작 변경 없음
