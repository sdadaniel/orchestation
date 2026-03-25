---
id: TASK-148
title: orchestrate.sh 비정상 종료 시 lock 자동 정리
status: pending
priority: high
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - scripts/orchestrate.sh
---

## 현상
- orchestrate.sh가 비정상 종료(kill, 에러 등)되면 /tmp/orchestrate.lock이 남아있음
- 다음 실행 시 "이미 실행 중" 오류로 실행 불가
- 수동으로 rmdir /tmp/orchestrate.lock 해야 함

## 수정 방향
- trap으로 EXIT/INT/TERM 시그널에 lock 정리 추가
- 또는 lock 파일에 PID 기록 → 시작 시 해당 PID가 살아있는지 확인 → 죽었으면 자동 정리

## Completion Criteria
- 비정상 종료 후 재실행 시 자동으로 lock 정리되어 정상 실행
- 정상 실행 중 중복 방지는 유지
