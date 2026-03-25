---
id: TASK-129
title: 글로벌 스타일 및 디자인 토큰 개선
status: failed
branch: task/task-129
worktree: ../repo-wt-task-129
priority: high
sort_order: 3
scope:
  - src/frontend/src/app/**
  - src/frontend/src/components/ui/**
created: 2026-03-25
updated: 2026-03-25
---
globals.css의 색상 변수, 타이포그래피, 간격, 반응형 레이아웃 등 디자인 기반 요소를 개선한다. 색상 팔레트 정제, 폰트 계층 구조 명확화, 공통 유틸리티 클래스 정비를 포함한다.

## Completion Criteria
- 색상 변수가 라이트/다크 모드 모두 일관적으로 적용됨
- 타이포그래피(font-size, line-height, font-weight) 계층이 명확히 정의됨
- card, border, shadow 등 공통 스타일이 통일됨
- board-card, task-row 등 기존 클래스의 시각적 품질이 향상됨
