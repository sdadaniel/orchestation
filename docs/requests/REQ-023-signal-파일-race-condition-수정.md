---
id: REQ-023
title: Signal 파일 race condition 수정
status: done
priority: high
created: 2026-03-24
---
orchestrate.sh에서 signal 파일(*-done, *-failed) 읽기/삭제에 lock이 없어 병렬 실행 시 race condition 발생.

## 문제
- `scripts/orchestrate.sh:244-253`
- 여러 worker가 동시에 signal 파일을 생성/삭제 가능
- task가 아직 실행 중인데 완료로 판단하거나 그 반대 상황

## Completion Criteria
- flock 또는 atomic rename 패턴으로 signal 파일 접근 보호
- 병렬 실행 시에도 정확한 상태 감지
