---
id: TASK-122
title: 프론트엔드 UI/인터랙션 버그 전수 탐색 및 수정
status: done
branch: task/task-122
worktree: ../repo-wt-task-122
priority: medium
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/app/page.tsx
  - src/frontend/src/app/tasks/page.tsx
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/app/tasks/new/page.tsx
  - src/frontend/src/app/notices/page.tsx
  - src/frontend/src/app/cost/page.tsx
  - src/frontend/src/app/settings/page.tsx
  - src/frontend/src/app/monitor/page.tsx
  - src/frontend/src/app/terminal/page.tsx
  - src/frontend/src/app/docs/page.tsx
  - src/frontend/src/app/docs/[id]/page.tsx
  - src/frontend/src/app/sprint/page.tsx
  - src/frontend/src/app/sprint/[id]/page.tsx
  - src/frontend/src/app/plan/page.tsx
  - src/frontend/src/components/AppShell.tsx
  - src/frontend/src/components/sidebar.tsx
  - src/frontend/src/components/RequestCard.tsx
  - src/frontend/src/components/DAGCanvas.tsx
  - src/frontend/src/components/ChatBot.tsx
  - src/frontend/src/components/AutoImproveControl.tsx
  - src/frontend/src/components/BatchEditor.tsx
  - src/frontend/src/components/GlobalSearch.tsx
  - src/frontend/src/components/TaskLogTab.tsx
  - src/frontend/src/components/TaskRow.tsx
  - src/frontend/src/components/RightPanel.tsx
  - src/frontend/src/components/MarkdownContent.tsx
  - src/frontend/src/components/HorseRunningIndicator.tsx
  - src/frontend/src/components/RunningIndicator.tsx
  - src/frontend/src/components/TimelineView.tsx
  - src/frontend/src/app/globals.css
  - src/frontend/src/app/tasks/constants.ts
---

## 목표
프론트엔드 전체 페이지와 컴포넌트를 점검하여 UI/인터랙션 버그를 찾아 수정한다.

## 점검 항목

### 상태/스타일 버그
- 필터/탭 클릭 시 active 상태 색상 미반영 (예: notices 페이지 필터 탭)
- hover 스타일 누락 또는 불일치
- 다크 테마에서 텍스트/배경 대비 부족
- 선택 상태가 시각적으로 구분되지 않는 요소

### 인터랙션 버그
- 클릭 이벤트 누락 또는 잘못된 전파 (stopPropagation 필요한 곳)
- 토글/접기 상태가 의도대로 동작하지 않는 경우
- 링크/버튼이 기대한 페이지로 이동하지 않는 경우
- 로딩 상태 미표시

### 타입/데이터 버그
- TypeScript 타입 불일치로 인한 조건부 렌더링 오류
- 빈 데이터/null 처리 누락
- API 응답과 프론트엔드 인터페이스 불일치

### 레이아웃 버그
- overflow 처리 누락 (긴 텍스트 잘림)
- 반응형 레이아웃 깨짐
- z-index 겹침 문제
