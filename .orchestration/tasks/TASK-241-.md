---
id: TASK-241
title: orchestration-manager.ts PID 읽기·프로세스 킬 중복 코드 및 silent catch 정리
status: in_progress
branch: task/task-241
worktree: ../repo-wt-task-241
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/lib/orchestration-manager.ts
---
`orchestration-manager.ts`에 PID 파일 읽기 패턴이 5회 중복되고, `stop()` 메서드 내 `catch { /* ignore */ }` 블록이 10개 이상 존재하여 디버깅이 불가능함.

- `readPidFromFile(path): number | null` 헬퍼 추출로 중복 제거
- silent catch를 `this.appendLog`를 통한 최소 로깅으로 교체
- `markAllInProgressAsStopped()`와 `cleanupZombies()`의 공통 태스크 파일 스캔 로직을 헬퍼로 추출

## Completion Criteria
- PID 파일 읽기 로직이 단일 헬퍼 함수로 통합됨
- silent catch 블록이 최소한의 로그 출력으로 교체됨
- 기존 동작(로직)은 변경 없이 유지됨
