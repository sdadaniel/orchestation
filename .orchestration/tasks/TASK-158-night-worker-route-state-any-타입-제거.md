---
id: TASK-158
title: night-worker route JSON.parse any 타입 제거
status: in_progress
branch: task/task-158
worktree: ../repo-wt-task-158
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/app/api/night-worker/route.ts
---

`src/frontend/src/app/api/night-worker/route.ts`에서 `JSON.parse()` 반환값이 `any`로 추론되어 state 객체의 타입 안전성이 손실되는 문제.

### 현황

- **Line 19**: `state` 변수가 inline object literal로 초기화되어 타입이 추론됨
- **Line 22**: `state = JSON.parse(fs.readFileSync(...))` → `any`가 대입되면서 이후 모든 `.` 접근이 타입 검사를 우회
- **Line 29**: `state.pid as number` — `any`이므로 type assertion 필요 (타입이 제대로 지정되었다면 불필요)
- **Line 123**: DELETE 핸들러에서도 동일 패턴 — `JSON.parse` 결과를 타입 없이 사용

### 수정 방향

1. `NightWorkerState` 인터페이스를 정의 (status, startedAt, until, budget, maxTasks, tasksCreated, totalCost, pid 필드)
2. Line 19의 초기값에 해당 타입 적용
3. Line 22, 123의 `JSON.parse` 결과에 `as NightWorkerState` 타입 단언 또는 타입 가드 적용
4. Line 29의 `as number` 제거 가능하도록 pid 필드를 `number | null`로 정의

## Completion Criteria
- `NightWorkerState` 인터페이스가 정의되어 있을 것
- `JSON.parse` 반환값에 명시적 타입이 지정되어 `any` 전파가 없을 것
- `as number` 같은 불필요한 type assertion이 제거되었을 것
- 기존 동작에 변경 없음 (로직 수정 금지)
