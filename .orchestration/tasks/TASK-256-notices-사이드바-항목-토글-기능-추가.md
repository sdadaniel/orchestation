---
id: TASK-256
title: Notices 사이드바 항목 토글 기능 추가
status: rejected
branch: task/task-256
worktree: ../repo-wt-task-256
priority: medium
scope:
  - src/frontend/src/components/**
created: 2026-03-27
updated: 2026-03-27
---
사이드바의 Notices 항목에 Docs/Tasks처럼 펼치기/접기(expand/collapse) 토글 기능을 추가한다. ChevronDown 아이콘 회전, noticesExpanded 상태 관리, sidebar-collapsible 클래스 적용 패턴을 동일하게 따른다.

## Completion Criteria
- Notices 헤더 클릭 시 목록이 펼쳐지고 접힌다
- ChevronDown 아이콘이 상태에 따라 회전한다
- 기본 상태는 펼쳐진(expanded) 상태이다
- 펼쳐진 상태에서는 기존과 동일한 노티스 목록이 표시된다
- 접힌 상태에서는 헤더(배지 포함)만 표시된다
