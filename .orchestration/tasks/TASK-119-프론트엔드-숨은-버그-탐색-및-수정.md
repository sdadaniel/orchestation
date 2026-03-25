---
id: TASK-119
title: 프론트엔드 숨은 버그 탐색 및 수정
status: done
branch: task/task-119
worktree: ../repo-wt-task-119
priority: high
scope:
  - src/frontend/src/app/**
  - src/frontend/src/components/**
  - src/frontend/src/hooks/**
  - src/frontend/src/lib/**
created: 2026-03-24
updated: 2026-03-24
---
src/frontend/ 전체를 조사하여 런타임 에러 가능성(null/undefined 접근, 빈 배열, 타입 불일치), API fetch 실패 시 에러 핸들링 누락, 조건분기 누락, 미사용 import/죽은 코드를 탐색한다. 실제 영향도가 있는 버그만 수정하고 스타일·리팩토링은 제외한다. 수정 내용은 버그별로 커밋 메시지에 기록한다.

## Completion Criteria
- src/frontend/src 하위 모든 파일을 읽고 버그 후보 목록 작성
- null/undefined 접근으로 런타임 에러 발생 가능한 코드 수정
- fetch/API 호출 실패 시 UI가 깨지는 에러 핸들링 누락 수정
- edge case에서 의도치 않은 동작을 유발하는 조건분기 누락 수정
- 미사용 import 및 죽은 코드 제거
- 수정 내용이 버그별로 커밋 메시지에 기록됨
