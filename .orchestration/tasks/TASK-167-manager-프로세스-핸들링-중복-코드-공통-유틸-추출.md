---
id: TASK-167
title: manager 프로세스 핸들링 중복 코드 공통 유틸 추출
status: failed
branch: task/task-167
worktree: ../repo-wt-task-167
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/lib/orchestration-manager.ts
  - src/frontend/src/lib/task-runner-manager.ts
  - src/frontend/src/lib/auto-improve-manager.ts
---

## 문제

3개 매니저 파일(`orchestration-manager.ts`, `task-runner-manager.ts`, `auto-improve-manager.ts`)에 거의 동일한 코드가 두 가지 패턴으로 중복되어 있다.

### 패턴 1: stdout/stderr 로그 수집 (3곳)

각 매니저가 `ChildProcess`의 stdout/stderr에 `on("data")` 핸들러를 등록하여 줄 단위로 분리 후 로그에 추가하는 동일한 로직을 반복한다.

- `orchestration-manager.ts` L99-116
- `task-runner-manager.ts` L82-92
- `auto-improve-manager.ts` L91-107

### 패턴 2: SIGTERM → 타임아웃 → SIGKILL 종료 (2곳)

프로세스 그룹 kill 시도 → 실패 시 단일 프로세스 kill → 5초 후 SIGKILL fallback 로직이 거의 복사-붙여넣기 수준으로 중복된다.

- `orchestration-manager.ts` L147-173
- `task-runner-manager.ts` L120-144

## 제안

공통 유틸 함수 2개를 추출한다 (예: `src/frontend/src/lib/process-utils.ts`):

1. `pipeProcessLogs(proc: ChildProcess, appendLog: (line: string) => void): void`
   - stdout/stderr data 이벤트를 줄 단위로 분리하여 appendLog 콜백으로 전달
2. `killProcessGracefully(proc: ChildProcess, timeoutMs?: number): void`
   - SIGTERM(프로세스 그룹 우선) → timeoutMs(기본 5000) 후 SIGKILL

각 매니저는 이 유틸을 호출하도록 수정한다. 로직 변경 없이 중복만 제거한다.

## Completion Criteria

- [ ] `process-utils.ts`(또는 유사 이름) 파일에 두 유틸 함수가 존재한다
- [ ] 3개 매니저 파일이 공통 유틸을 사용하도록 리팩터링되었다
- [ ] 기존 동작(로그 수집, graceful shutdown)이 변경 없이 유지된다
- [ ] TypeScript 컴파일 에러가 없다
