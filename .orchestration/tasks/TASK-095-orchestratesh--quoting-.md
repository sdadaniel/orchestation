---
id: TASK-095
title: orchestrate.sh 변수 quoting 수정
status: done
priority: high
sprint:
depends_on: [TASK-094]
branch: task/TASK-095-orchestratesh--quoting-
worktree: ../repo-wt-TASK-095
role: general
reviewer_role: reviewer-general
---

# TASK-095: orchestrate.sh 변수 quoting 수정

## 원본 요청

- Request: REQ-019
- 제목: 쉘 스크립트 변수 quoting 수정
- 내용: orchestrate.sh의 cmd 문자열 내 변수들이 unquoted 상태로, 경로에 공백이나 한글이 포함되면 명령이 깨지는 문제 수정.

## 문제
- `scripts/orchestrate.sh:180` — `${task_id}`, `${SIGNAL_DIR}`, `${log_file}` 등이 unquoted
- 경로에 공백 있으면 tee 등 후속 명령이 잘못된 인자를 받음

## Completion Criteria
- cmd 문자열 내 모든 변수가 적절히 quoted 처리
- 공백/한글 포함 경로에서도 정상 동작 확인

## 완료 조건

- `scripts/orchestrate.sh` 내 cmd 문자열에서 `${task_id}`, `${SIGNAL_DIR}`, `${log_file}` 등 unquoted 변수를 모두 큰따옴표로 감싸기
- 경로에 공백 또는 한글이 포함된 경우에도 tee 및 후속 명령이 올바른 인자를 받는지 확인
- 수정 후 공백 포함 경로로 스크립트 동작 검증
