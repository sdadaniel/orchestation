---
id: TASK-131
title: Task 목록 및 상세 페이지 디자인 개선
status: done
branch: task/task-131
worktree: ../repo-wt-task-131
priority: medium
scope:
  - src/frontend/src/app/tasks/**
  - src/frontend/src/components/**
depends_on: [TASK-129]
created: 2026-03-25
updated: 2026-03-25
---
tasks/page.tsx, tasks/[id]/page.tsx, tasks/new/page.tsx의 레이아웃, 카드, 필터 UI, 탭 등 전반적인 시각 품질을 개선한다. RequestCard, DAGCanvas, AutoImproveControl 컴포넌트 포함.

## Completion Criteria
- Task 목록 페이지의 카드/행 디자인이 시각적으로 개선됨
- Task 상세 페이지의 섹션 구분과 정보 계층이 명확함
- 필터 pill, 탭, 정렬 버튼 등 인터랙티브 요소 디자인이 통일됨
- 새 Task 생성 폼 레이아웃이 개선됨
- DAGCanvas 노드 및 엣지 스타일이 전체 디자인과 조화를 이룸
