---
id: TASK-297
title: 셸 스크립트 린트 전체 점검 및 수정
status: failed
branch: task/task-297
worktree: ../repo-wt-task-297
priority: high
role: devops
scope:
  - scripts/**
created: 2026-03-31 15:16:37
updated: 2026-03-31 06:18
---
scripts/ 디렉토리 내 모든 .sh 파일에 대해 `bash -n` 문법 검사를 실행하고, macOS bash 3.x 비호환 문법(declare -A, mapfile, readarray 등)을 탐지하여 수정한다.

## Completion Criteria
- 모든 .sh 파일 bash -n 통과
- declare -A, mapfile, readarray 등 bash 4+ 전용 문법 0건
- main 스코프에서 local 키워드 사용 0건
