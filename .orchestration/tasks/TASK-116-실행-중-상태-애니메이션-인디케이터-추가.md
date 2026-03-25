---
id: TASK-116
title: 실행 중 상태 애니메이션 인디케이터 추가
status: done
branch: task/task-116
worktree: ../repo-wt-task-116
priority: medium
scope:
  - src/frontend/src/components/AppShell.tsx
  - src/frontend/src/app/globals.css
  - src/frontend/src/components/RunningIndicator.tsx
  - src/frontend/src/hooks/useRequests.ts
created: 2026-03-24
updated: 2026-03-24 11:02:59
---
run이 실행 중일 때 상단(헤더 또는 사이드바 상단)에 스피너, 펄스 애니메이션, 또는 움직이는 아이콘을 표시하여 사용자가 작업이 진행 중임을 시각적으로 인지할 수 있도록 한다. 실행 완료 시 인디케이터가 사라지거나 완료 상태로 전환된다.

## Completion Criteria
- 실행 중인 task가 1개 이상 있을 때 헤더 또는 사이드바 상단에 애니메이션 인디케이터(스피너/펄스/아이콘)가 표시된다
- 실행 중인 task가 없을 때는 인디케이터가 표시되지 않는다
- 인디케이터는 CSS 애니메이션으로 지속적으로 움직여 진행 중임을 명확히 전달한다
- 인디케이터에 현재 실행 중인 task 수 또는 간단한 상태 텍스트(예: 'Running...')가 함께 표시된다
