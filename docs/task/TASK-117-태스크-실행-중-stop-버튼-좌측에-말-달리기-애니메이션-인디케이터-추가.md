---
id: TASK-117
title: 태스크 실행 중 Stop 버튼 좌측에 말 달리기 애니메이션 인디케이터 추가
status: in_progress
branch: task/task-117
worktree: ../repo-wt-task-117
priority: low
scope:
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/components/RunningIndicator.tsx
created: 2026-03-24
updated: 2026-03-24
---
태스크 상세 페이지에서 runStatus === 'running' 또는 task.status === 'in_progress' 일 때 Stop 버튼 왼쪽에 말이 달리는 이모지 애니메이션(🐎) 또는 CSS keyframe 기반 스피너를 표시한다. 말 달리기 효과는 이모지 bounce/run 애니메이션으로 구현하거나, 이모지 프레임(🐎🏇) 전환으로 구현한다. 기존 RunningIndicator 컴포넌트와 별개로, 헤더 내 버튼 영역에만 적용한다.

## Completion Criteria
- runStatus === 'running' 또는 task.status === 'in_progress' 상태일 때 Stop 버튼 좌측에 말 달리기 애니메이션이 표시된다
- 애니메이션은 CSS keyframe 또는 이모지 프레임 전환 방식으로 구현되어 실제로 움직이는 것처럼 보인다
- 실행 중이 아닐 때(idle/completed/failed)는 애니메이션이 표시되지 않는다
- 기존 Stop/Run 버튼 동작에 영향을 주지 않는다
