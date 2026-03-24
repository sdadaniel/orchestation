---
id: REQ-019
title: 쉘 스크립트 변수 quoting 수정
status: done
priority: high
created: 2026-03-24
---
orchestrate.sh의 cmd 문자열 내 변수들이 unquoted 상태로, 경로에 공백이나 한글이 포함되면 명령이 깨지는 문제 수정.

## 문제
- `scripts/orchestrate.sh:180` — `${task_id}`, `${SIGNAL_DIR}`, `${log_file}` 등이 unquoted
- 경로에 공백 있으면 tee 등 후속 명령이 잘못된 인자를 받음

## Completion Criteria
- cmd 문자열 내 모든 변수가 적절히 quoted 처리
- 공백/한글 포함 경로에서도 정상 동작 확인
