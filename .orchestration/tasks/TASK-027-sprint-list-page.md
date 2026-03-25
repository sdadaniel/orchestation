---
id: TASK-027
title: Sprint 목록 페이지
status: done
priority: high
sprint: SPRINT-005
depends_on:
    - TASK-026
branch: task/TASK-027-sprint-list-page
worktree: ../repo-wt-TASK-027
role: fe-developer
reviewer_role: reviewer-general
---

# TASK-027: Sprint 목록 페이지

## 목표

/sprint 라우트에 Sprint 목록 페이지를 구현하고 사이드바 탭을 활성화한다.

## 완료 조건

- [ ] `/sprint` 페이지에 Sprint 카드 목록 표시 (제목, 상태 뱃지, 진행률 바)
- [ ] 진행률은 포함된 Task 중 done 상태 비율로 계산
- [ ] 각 Sprint 카드 클릭 시 `/sprint/[id]` 로 이동
- [ ] 사이드바 Sprint 탭 `disabled: false`로 변경
- [ ] Sprint가 없을 때 빈 상태(empty state) 표시
