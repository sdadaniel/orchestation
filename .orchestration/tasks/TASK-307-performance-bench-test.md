---
id: TASK-307
title: 성능 벤치마크 테스트 - 간단한 파일 생성
status: in_progress
branch: task/task-307
worktree: ../repo-wt-task-307
priority: high
sort_order: 1
scope:
  - output/perf-test/
created: 2026-04-02 22:00
updated: 2026-04-02 15:45
---

## 목표
`output/perf-test/bench.txt` 파일을 생성하여 성능 테스트를 수행한다.

## 작업 내용
1. `output/perf-test/` 디렉토리가 없으면 생성
2. `output/perf-test/bench.txt` 파일에 "Performance test TASK-307 completed at $(date)" 작성
3. 완료
