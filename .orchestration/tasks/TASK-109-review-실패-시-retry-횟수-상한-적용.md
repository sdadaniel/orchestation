---
id: TASK-109
title: review 실패 시 retry 횟수 상한 적용
status: done
priority: high
sort_order: 1
created: 2026-03-24
updated: 2026-03-24
branch: task/TASK-109-review-retry-limit
worktree: ../repo-wt-TASK-109
role: general
reviewer_role: reviewer-general
scope:
  - scripts/run-worker.sh
  - scripts/orchestrate.sh
---
orchestrate.sh 또는 run-pipeline.sh에서 review 실패 시 무한 재시도를 방지하기 위해 최대 retry 횟수(예: 2~3회)를 설정한다. 상한 초과 시 해당 태스크를 failed 상태로 마킹하고 파이프라인을 중단하거나 다음 태스크로 넘어가도록 처리한다. retry 횟수와 실패 사유를 로그에 기록한다.

## Completion Criteria
- review 실패 시 retry 횟수가 설정된 상한(MAX_RETRY)을 초과하지 않음
- 상한 초과 시 태스크가 failed로 마킹되고 파이프라인이 무한 루프에 빠지지 않음
- retry 횟수 및 실패 사유가 로그에 명시됨
- MAX_RETRY 값이 환경 변수 또는 설정으로 조정 가능함
