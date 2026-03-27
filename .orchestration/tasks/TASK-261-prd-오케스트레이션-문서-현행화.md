---
id: TASK-261
title: PRD 오케스트레이션 문서 현행화
status: in_progress
branch: task/task-261
worktree: ../repo-wt-task-261
priority: medium
role: prd-architect
scope:
  - docs/prd/**
created: 2026-03-27 17:08:37
updated: 2026-03-27 17:08:37
---
docs/prd/doc-orchestration.md를 현재 코드 기준으로 동기화한다.

현재 문서에 run-task.sh, run-review.sh, run-worker.sh 등 존재하지 않는 파일이 기술되어 있음.
실제 파일 구조(job-task.sh, job-review.sh, orchestrate.sh)에 맞게 수정한다.

## Completion Criteria
- docs/prd/doc-orchestration.md가 현재 scripts/ 디렉토리 구조와 일치
- 존재하지 않는 파일 참조 제거
- 실제 실행 흐름(orchestrate → job-task → job-review → merge) 반영
