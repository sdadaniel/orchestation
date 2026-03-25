---
id: TASK-120
title: 스크립트 숨은 버그 탐색 및 수정
status: done
branch: task/task-120
worktree: ../repo-wt-task-120
priority: high
scope:
  - scripts/**
  - scripts/lib/**
created: 2026-03-24
updated: 2026-03-24
---
scripts/ 전체를 조사하여 미사용 변수, 잘못된 파일 경로, quoting 누락(공백 포함 경로 오작동), 조건분기 누락, 죽은 코드를 탐색한다. 실제 영향도가 있는 버그만 수정하고, 수정 내용은 버그별로 커밋 메시지에 기록한다.

## Completion Criteria
- scripts/ 하위 모든 .sh 파일을 읽고 버그 후보 목록 작성
- quoting 누락으로 인한 공백·특수문자 처리 오류 수정
- 잘못된 파일 경로 참조 수정
- 미사용 변수 및 죽은 코드 제거
- 수정 내용이 버그별로 커밋 메시지에 기록됨
