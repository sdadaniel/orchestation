---
id: TASK-184
title: Monitor에서 오케스트레이트 워커 Claude 프로세스만 표시
status: in_progress
branch: task/task-184
worktree: ../repo-wt-task-184
priority: medium
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/app/monitor/page.tsx
  - src/frontend/src/app/api/monitor/route.ts
---

## 현상
- Monitor 페이지에서 Claude 프로세스가 12개로 표시됨
- 유저가 별도로 사용 중인 Claude CLI까지 모두 포함
- 오케스트레이트 워커만 구분해서 보고 싶음

## 수정 방향
- 프로세스 목록에서 run-worker.sh 또는 worktree 경로로 실행된 Claude만 필터
- 또는 PID 파일(/tmp/worker-TASK-XXX.pid)로 관리되는 프로세스만 표시
- 유저 Claude와 워커 Claude 구분 표시 (태그 또는 섹션 분리)

## Completion Criteria
- Monitor에서 오케스트레이트 워커 프로세스만 기본 표시
- 전체 보기 토글로 유저 Claude도 볼 수 있도록 (선택)
