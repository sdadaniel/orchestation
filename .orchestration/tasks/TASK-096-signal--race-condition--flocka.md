---
id: TASK-096
title: Signal 파일 race condition 수정 (flock/atomic rename 적용)
status: done
priority: high
sprint:
depends_on: [TASK-095]
branch: task/TASK-096-signal--race-condition--flocka
worktree: ../repo-wt-TASK-096
role: general
reviewer_role: reviewer-general
---

# TASK-096: Signal 파일 race condition 수정 (flock/atomic rename 적용)

## 원본 요청

- Request: REQ-023
- 제목: Signal 파일 race condition 수정
- 내용: orchestrate.sh에서 signal 파일(*-done, *-failed) 읽기/삭제에 lock이 없어 병렬 실행 시 race condition 발생.

## 문제
- `scripts/orchestrate.sh:244-253`
- 여러 worker가 동시에 signal 파일을 생성/삭제 가능
- task가 아직 실행 중인데 완료로 판단하거나 그 반대 상황

## Completion Criteria
- flock 또는 atomic rename 패턴으로 signal 파일 접근 보호
- 병렬 실행 시에도 정확한 상태 감지

## 완료 조건

- `scripts/orchestrate.sh` 244-253 라인의 signal 파일(*-done, *-failed) 읽기/삭제 로직 분석
- `flock` 또는 atomic rename 패턴으로 signal 파일 접근 보호 구현
- 병렬 worker가 동시에 signal 파일을 생성/삭제할 때 중복 처리 또는 누락이 없음을 보장
- 기존 orchestrate.sh의 signal 기반 상태 감지 흐름이 정상 동작함을 확인
