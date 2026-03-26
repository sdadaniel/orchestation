---
id: TASK-149
title: Running 인디케이터 애니메이션이 검색창 레이아웃에 영향주는 버그 수정
status: done
branch: task/task-149
worktree: ../repo-wt-task-149
priority: high
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/components/RunningIndicator.tsx
  - src/frontend/src/components/AppShell.tsx
  - src/frontend/src/app/globals.css
---

## 현상
- 상단바의 "Running..." 인디케이터가 애니메이션(dots 깜박임 등)할 때 너비가 변함
- 너비 변화가 옆에 있는 검색창 위치를 밀어서 검색창이 같이 움직임
- 레이아웃 시프트(layout shift) 발생

## 수정 방향
- Running 인디케이터에 고정 너비(min-width) 설정
- 또는 dots 애니메이션을 너비 변화 없는 방식으로 변경 (opacity만 사용)
- 또는 상단바를 flex로 검색창 위치를 고정 (flex-1 + shrink-0)

## Completion Criteria
- Running 상태에서 검색창이 움직이지 않음
- 인디케이터 애니메이션은 정상 동작
