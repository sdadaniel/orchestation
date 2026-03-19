---
id: TASK-013
title: Task 바 컴포넌트
sprint: SPRINT-002
status: done
priority: critical
depends_on:
  - TASK-011
blocks:
  - TASK-016
parallel_with:
  - TASK-012
  - TASK-014
role: frontend-dev
branch: task/TASK-013-task-bar
worktree: ../repo-wt-TASK-013
reviewer_role: reviewer-general
affected_files:
  - src/frontend/components/waterfall/TaskBar.tsx
---

## 목표

워터폴 뷰에서 개별 Task를 수평 바로 표현하는 컴포넌트를 구현한다.

## 무엇을

- `src/frontend/components/waterfall/TaskBar.tsx`

## 어떻게

- **Tailwind CSS**로 직접 구현
- 수평 바 형태, 상태별 배경색 (TASK-011의 상수 사용)
- 바 안에 Task ID + title 표시
- 우선순위 뱃지 표시
- role 태그 표시
- 클릭 이벤트 핸들러 (onClick → 사이드 패널 연결은 TASK-015에서)
- hover 시 약간의 하이라이트 효과

## 입출력

- 입력: `WaterfallTask` + `onClick` 콜백
- 출력: 상태 색상이 적용된 수평 바 UI

## 완료 조건

- 상태별 색상이 정확히 적용됨
- Task ID, title, priority 뱃지, role 태그가 표시됨
- 클릭 가능하며 onClick 콜백이 호출됨
