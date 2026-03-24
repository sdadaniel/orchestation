---
id: TASK-114
title: Tasks 페이지에 Jira 타임라인 뷰 추가
status: in_progress
priority: high
sprint:
depends_on: []
branch: task/TASK-114-tasks-page-jira-timeline-view
worktree: ../repo-wt-TASK-114
role: frontend-dev
reviewer_role: reviewer-general
scope:
  - src/frontend/src/app/tasks/page.tsx
  - src/frontend/src/components/TimelineView.tsx
  - src/frontend/src/hooks/useRequests.ts
  - src/frontend/src/hooks/useTasks.ts
---

# TASK-114: Tasks 페이지에 Jira 타임라인 뷰 추가

## 목표

/tasks 페이지의 탭에 Jira 스타일 타임라인(Gantt) 뷰를 추가한다.
기존 Graph / All / 상태별 탭과 동일한 레벨로 "Timeline" 탭을 추가.

## 현재 상태

- 탭: Graph, All, In Progress, Reviewing, Pending, Done, Rejected
- 데이터: created, updated, status, priority, depends_on 사용 가능

## 완료 조건

- [ ] 탭 바에 "Timeline" 탭 추가 (Graph 옆)
- [ ] 타임라인 뷰는 가로축이 날짜(일 단위), 세로축이 태스크 목록
- [ ] 각 태스크는 created ~ updated (또는 현재 날짜) 범위의 수평 바로 표시
- [ ] 바 색상은 status에 따라 구분 (pending=노랑, in_progress=파랑, done=초록, rejected=빨강)
- [ ] 태스크 ID와 제목이 왼쪽에 표시, 클릭 시 상세 페이지로 이동
- [ ] depends_on 관계를 화살표로 표시 (선택: 구현 가능하면)
- [ ] priority별 필터 적용 가능
- [ ] 가로 스크롤/드래그로 날짜 범위 이동 가능
