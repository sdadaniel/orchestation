---
id: TASK-208
title: orchestrate.sh 중복 실행 방지 lock 추가
status: in_progress
branch: task/task-208
worktree: ../repo-wt-task-208
priority: high
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - scripts/orchestrate.sh
---

## 현상
- orchestrate.sh에 중복 실행 방지 로직이 없음
- 웹 UI에서 여러 번 트리거하거나 auto-improve.sh가 호출하면 2개 이상 동시에 뜰 수 있음
- 동시 실행 시 슬롯 계산 꼬임, 같은 태스크 중복 배정 등 문제 발생 가능

## 수정 방향
- flock 또는 PID 파일 기반 lock 메커니즘 추가
- 이미 실행 중이면 새 인스턴스는 즉시 종료 (또는 기존 프로세스에 위임)
- 종료 시 lock 해제 (trap으로 정리)

## Completion Criteria
- orchestrate.sh 동시 2개 이상 실행 불가
- 기존 인스턴스 비정상 종료 시에도 stale lock 처리 (PID 검증)
