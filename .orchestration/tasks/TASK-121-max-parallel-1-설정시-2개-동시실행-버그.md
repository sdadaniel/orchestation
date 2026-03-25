---
id: TASK-121
title: MAX_PARALLEL=1 설정 시 2개 태스크 동시 실행되는 버그 수정
status: done
branch: task/task-121
worktree: ../repo-wt-task-121
priority: high
created: 2026-03-24
updated: 2026-03-24
depends_on: []
scope:
  - scripts/orchestrate.sh
---

## 현상
- MAX_PARALLEL을 1로 설정했는데 태스크가 2개 동시에 실행됨

## 원인 조사 필요
- `RUNNING` 배열에서 완료된 태스크가 제때 빠지지 않는지
- `process_done_task()` 반환값 처리에서 RUNNING 갱신 타이밍 이슈
- `start_task()`가 비동기(iTerm 패널)라 슬롯 카운트와 실제 실행 수 불일치 가능성
- settings API에서 가져온 maxParallel 값이 스크립트 환경변수에 제대로 반영되는지

## 수정 방향
- 슬롯 체크 로직 디버깅 후 근본 원인 수정
- 태스크 투입 전 `RUNNING` 배열 크기를 로그로 출력하여 확인
