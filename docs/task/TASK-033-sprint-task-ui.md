---
id: TASK-033
title: Sprint/Task 생성 UI
status: in_progress
priority: high
sprint: SPRINT-007
depends_on:
    - TASK-031
branch: task/TASK-033-sprint-task-ui
worktree: ../repo-wt-TASK-033
role: general
reviewer_role: reviewer-general
---

# TASK-033: Sprint/Task 생성 UI

## 목표

웹 대시보드에서 Sprint를 정의하고 Task를 추가/편집할 수 있는 UI를 구현한다.

## 완료 조건

- [ ] Sprint 생성 폼: 제목, 목표, 상태 입력
- [ ] Sprint 내 Task 추가: Task 제목, 우선순위, 역할, 의존성 선택
- [ ] Sprint 내 Task 배치 편집: 배치 구성 (드래그 또는 선택)
- [ ] Task 편집 모달/패널: 기존 Task의 상태, 우선순위, 의존성 수정
- [ ] Task 삭제 확인 다이얼로그
- [ ] Sprint 상세 페이지(/sprint/[id])에 "Add Task" 버튼 추가
- [ ] 사이드바 Sprints 섹션에 "New Sprint" 버튼 추가
- [ ] 폼 제출 시 /api/sprints, /api/tasks API 호출
- [ ] 생성/수정 후 대시보드 자동 새로고침
