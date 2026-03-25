---
id: TASK-128
title: 글로벌 스타일 및 UI 기초 컴포넌트 점검
status: in_progress
branch: task/task-128
worktree: ../repo-wt-task-128
priority: medium
sort_order: 1
scope:
  - src/frontend/src/app/**
  - src/frontend/src/components/ui/**
created: 2026-03-25
updated: 2026-03-25
---
globals.css, 뱃지, date-picker 등 기반 스타일과 UI 컴포넌트의 디자인 토큰(색상 변수, 폰트, 그림자 등)을 점검하고 정리한다.

## Completion Criteria
- CSS 변수(디자인 토큰)가 일관되게 정의되고 사용되는지 확인
- 다크모드/라이트모드 대응이 올바른지 확인
- date-picker, badge 등 신규 UI 컴포넌트가 기존 디자인 시스템과 통일되는지 확인
- 불필요한 인라인 스타일이나 중복 스타일 제거
