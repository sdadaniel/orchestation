---
id: TASK-203
title: 태스크 상세페이지 stop 버튼 클릭 시 실제 정지 안 되는 버그 수정
status: in_progress
branch: task/task-203
worktree: ../repo-wt-task-203
priority: high
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/app/api/tasks/[id]/route.ts
  - scripts/orchestrate.sh
  - scripts/run-worker.sh
  - scripts/lib/signal.sh
---

## 현상
- in_progress 상태의 태스크 상세페이지에서 stop 버튼을 클릭해도 태스크가 정지되지 않음
- UI에서 상태가 변경되지 않거나, 변경되더라도 실제 워커 프로세스가 계속 실행됨

## 조사 범위
1. **프론트엔드**: stop 버튼 클릭 → API 호출이 정상적으로 발생하는지 (네트워크 탭 확인)
2. **API 라우트**: PATCH /api/tasks/[id]에서 status: stopped 업데이트가 파일에 실제 반영되는지
3. **orchestrate.sh**: stopped 상태를 감지하고 워커 프로세스를 종료하는 로직이 있는지
4. **run-worker.sh**: 실행 중 태스크 상태 변경을 폴링하거나 시그널을 받는 메커니즘이 있는지
5. **signal.sh**: stop 시그널 파일 생성/소비 흐름이 정상인지

## Completion Criteria
- stop 버튼 클릭 시 API 호출 → 파일 상태 변경 → 워커 프로세스 종료까지 전체 흐름 동작
- 정지된 태스크의 UI 상태가 즉시 반영됨
