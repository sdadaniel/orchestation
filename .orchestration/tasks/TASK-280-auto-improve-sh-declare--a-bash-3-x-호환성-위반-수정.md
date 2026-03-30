---
id: TASK-280
title: auto-improve.sh declare -A bash 3.x 호환성 위반 수정
status: done
branch: task/task-280
worktree: ../repo-wt-task-280
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - scripts/auto-improve.sh
  - docs/todo/bash3-compat-declare-A.md
---
`scripts/auto-improve.sh` 398행의 `declare -A EVAL_RESULTS_MAP=()`는 bash 4.0+ 전용 문법이다.
macOS 기본 bash 3.x에서 런타임 에러가 발생하므로, 인덱스 배열로 대체하여 호환성을 확보한다.

분석 보고서: `docs/todo/bash3-compat-declare-A.md`

## Completion Criteria
- `scripts/auto-improve.sh`에서 `declare -A` 사용이 제거됨
- bash 3.x 호환 인덱스 배열로 대체됨
- `bash -n scripts/auto-improve.sh` 문법 검사 통과
