---
id: TASK-252
title: Notices 사이드바 항목에 2depth 토글 arrow 추가
status: in_progress
branch: task/task-252
worktree: ../repo-wt-task-252
priority: medium
scope:
  - src/frontend/src/components/**
  - src/frontend/src/app/notices/**
created: 2026-03-26
updated: 2026-03-26
---
사이드바의 Notices 항목에도 펼침/접힘 arrow를 추가한다. Tasks와 동일한 패턴으로 구현하여 일관성을 유지한다.

## Completion Criteria
- Notices 사이드바 항목에 chevron/arrow 아이콘이 표시된다
- 클릭 시 하위 항목이 펼쳐지고 접힌다
- arrow 방향이 펼침/접힘 상태에 따라 변경된다
- Tasks, Docs 항목과 시각적으로 일관성이 있다
