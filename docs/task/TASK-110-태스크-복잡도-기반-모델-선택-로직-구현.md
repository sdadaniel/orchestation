---
id: TASK-110
title: 태스크 복잡도 기반 모델 선택 로직 구현
status: in_progress
branch: task/task-110
worktree: ../repo-wt-task-110
priority: medium
sort_order: 6
created: 2026-03-24
updated: 2026-03-24
---
orchestrate.sh에서 태스크의 복잡도(예: 태스크 타입, 파일 수정 범위, 키워드)를 판단하여 단순 태스크는 claude-haiku-4-5, 복잡한 태스크는 claude-sonnet-4-6을 사용하도록 모델 선택 로직을 추가한다. 태스크 문서 내 complexity 필드 또는 태스크 제목/설명의 휴리스틱으로 분류한다.

## Completion Criteria
- 단순 태스크(예: 문서 업데이트, 단일 파일 수정, 설정 변경)에 haiku 모델이 자동 선택됨
- 복잡한 태스크(다중 파일 수정, 리팩토링, 신규 기능)에 sonnet 모델이 사용됨
- 모델 선택 기준이 명시적으로 정의되어 있고 오버라이드 가능함
- haiku 적용 태스크에서 실제 비용이 감소함을 로그로 확인 가능함
